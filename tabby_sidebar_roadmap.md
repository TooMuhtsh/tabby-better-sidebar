# Roadmap — tabby-sidebar-plus

Plugin Tabby : sidebar de profils enrichie (favoris, statut live, drag & drop,
SFTP docké façon FileZilla) — construit à partir du composant `profile-tree`
natif de Tabby (MIT, voir THIRD-PARTY-NOTICES.md).

Dépôt : `C:\Users\Alex Ramirez\Documents\Développement\tabby-ssh-sidebar`
(git initialisé, pas encore de premier commit — `git config user.name/email`
pas encore réglé, à faire avant de committer).

## Fait

- **Environnement de dev** : Node.js v24.18.0 installé en version portable
  (zip, pas d'admin requis) dans
  `%LOCALAPPDATA%\Programs\nodejs-portable`, ajouté au PATH utilisateur.
- **Scaffold du plugin** : package.json, tsconfig.json, webpack.config.js,
  LICENSE (MIT), THIRD-PARTY-NOTICES.md (attribution Tabby/Eugene Pankov).
- **Composant de base** (`src/components/sidebarTree.component.ts/.pug/.scss`) :
  repris du `ProfileTreeComponent` natif de Tabby (groupes pliables, recherche
  floue, redimensionnement) — aucune fonctionnalité "vision" (favoris/statut/
  drag&drop/SFTP) encore ajoutée à ce stade, c'est la base brute.
- **Montage dans l'UI** (`src/mount.service.ts`) : le composant natif
  `profile-tree` n'étant pas exporté par `tabby-core`, impossible de le
  réutiliser via un simple import Angular. On l'injecte donc nous-même dans le
  DOM (`createComponent` + `ApplicationRef.attachView`) comme premier enfant
  flex de `.window.h-100.d-flex`, avec un `ConfigProvider` pour activer/
  désactiver via `config.store.sidebarPlus.enabled`.
- **Build** : `npm run build` (webpack) compile sans erreur.
- **Boucle de dev validée de bout en bout** : le plugin se charge réellement
  dans Tabby 1.0.235 et s'affiche (arborescence complète, 50 items de test).

## Pièges rencontrés (à ne pas refaire)

1. **`TABBY_PLUGINS` casse sur Windows.** Le loader de Tabby fait
   `process.env.TABBY_PLUGINS.split(':')` (mécanisme façon `$PATH` Unix) —
   un chemin Windows absolu (`C:\Users\...`) contient un `:` juste après la
   lettre de lecteur, donc le chemin est tronqué et le plugin n'est jamais
   trouvé, **sans erreur visible**. C'est un bug de Tabby, pas de notre code.
   → **Solution retenue** : ne pas utiliser `TABBY_PLUGINS` du tout. Créer une
   jonction NTFS du dossier du plugin directement dans
   `%APPDATA%\tabby\plugins\node_modules\tabby-sidebar-plus` (le même
   emplacement où vivent les plugins installés comme SFTP+). Commande :
   ```powershell
   New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-sidebar-plus" -Target "C:\Users\Alex Ramirez\Documents\Développement\tabby-ssh-sidebar"
   ```
   Puis relancer `Tabby.exe` normalement (pas besoin de variable d'env).
2. **`package.json` sans champ `author` → échec silencieux.** Le code de
   découverte de plugins de Tabby fait `author.name || author` sans vérifier
   que `info.author` existe. Si absent, `undefined.name` lève une exception,
   attrapée par un `catch` générique qui logue juste
   `"Cannot load package info for X"` (sans le vrai message d'erreur).
   → Toujours mettre un champ `"author"` (même vide) dans le package.json.
3. **`templateUrl`/`styleUrls` ne marchent PAS pour un plugin tiers.** Ces
   propriétés Angular ne sont résolues (fetch HTTP + `resolveComponentResources()`)
   qu'au bootstrap principal de l'appli — les composants de plugins chargés
   après coup plantent avec `Component 'X' is not resolved... Did you run and
   wait for 'resolveComponentResources()'?`. L'exemple officiel `tabby-clippy`
   montre le bon pattern :
   ```ts
   @Component({ template: require('./x.pug') })  // pas templateUrl
   ```
   Pour le SCSS : import en side-effect (`import './x.scss'`) + règle webpack
   `style-loader/css-loader/sass-loader` (injection globale, pas de
   `styleUrls`). Nécessite aussi `apply-loader` devant `pug-loader` dans
   webpack.config.js pour que `require('./x.pug')` retourne bien une string.
4. **Contraintes de versions pour matcher Angular 15** (peer dep de
   `tabby-core`) :
   - `typescript` doit être `^4.9.x` (pas 5.x, incompatible avec
     `@angular/compiler-cli@15`).
   - `pug` doit être `^2.0.x` (`pug-loader@2.4.0` exige `pug@^2.0.0`, pas 3.x).
   - `@types/node` doit être épinglé à `^18.19.0` — la dernière version (26.x)
     embarque des typings pour l'API expérimentale `node:ffi` qui ne parsent
     pas sous TS 4.9.
   - `@ng-bootstrap/ng-bootstrap` doit être `^14.x` (pas la dernière version
     npm, qui vise Angular 18+).
5. **`npm install` échoue sur `tabby-ssh` (postinstall natif).** Son script
   `postinstall` (via `run-script-os`) essaie de compiler des bindings natifs
   qu'on n'utilise pas (on ne consomme que ses types TS). →
   `npm install --ignore-scripts`.
6. **Les typings npm de `tabby-core` sont en retard sur l'app installée.**
   `buildGroupTree()` sur `ProfilesService`, et `icon`/`color`/`parentGroupId`
   sur `ProfileGroup` existent à l'exécution (version 1.0.235 installée) mais
   pas dans les types publiés (tag `nightly` sur npm, un peu plus vieux). →
   Fichier d'augmentation `src/tabby-core-augment.d.ts` qui restaure ces types
   plutôt que de disséminer des `any`.
7. **La sidebar native existe déjà**, cachée : Paramètres → Window →
   "Show profile sidebar" (`config.store.showProfileTree`, composant
   `profile-tree` dans `tabby-core`). Si un jour on doute qu'un problème vient
   de notre plugin, comparer avec le comportement natif (à activer/désactiver
   pour ne pas avoir les deux en même temps).
8. **Debug utile** : `Tabby.exe --debug --remote-debugging-port=9333` expose le
   protocole Chrome DevTools ; on peut s'y connecter en Node (WebSocket natif
   de Node 22+) pour lire la vraie console (`Runtime.consoleAPICalled`,
   `Log.entryAdded`) et interroger le DOM (`Runtime.evaluate`) sans dépendre
   de captures d'écran. Très utile car les erreurs de chargement de plugin
   sont souvent avalées par des `catch` génériques côté Tabby.
   ⚠️ Important : après une modification du plugin, il faut **tuer et
   relancer tout le process** `Tabby.exe` (pas juste `Page.reload` /
   `Ctrl+R`) — `process.env.NODE_PATH` et le cache de modules Node sont
   globaux au process et ne se réinitialisent pas sur un simple reload de
   page.

## Reste à faire (la "vision" demandée)

Les 4 axes validés avec l'utilisateur, aucun n'est encore implémenté :

1. **Accès SFTP direct, docké, façon FileZilla** — inspiré du plugin SFTP+
   déjà installé localement (`%APPDATA%\tabby\plugins\node_modules\tabby-sftp-plus`,
   code source lisible directement, licence à vérifier avant réutilisation
   mais l'utilisateur a déjà donné son accord pour s'en inspirer/reprendre du
   code). Contraintes explicites de l'utilisateur :
   - PAS une fenêtre flottante — ancré dans la mise en page (même technique
     d'injection flex que la sidebar).
   - Double-panneau optionnel : possibilité d'afficher ou non les fichiers
     locaux (comme FileZilla).
   - Réutiliser si possible la logique remote de `SFTPPanelComponent`/
     `SFTPSession` de `tabby-ssh` (navigation, upload/download, création de
     dossier) plutôt que tout réécrire — reste à valider si ces classes sont
     exportées/réutilisables depuis un plugin tiers ou si elles doivent aussi
     être adaptées en local (comme on l'a fait pour `profile-tree`).
2. **Indicateur de statut de connexion en direct** par profil (point/icône
   coloré : connecté / erreur / déconnecté).
3. **Favoris épinglés** en haut de l'arborescence, indépendamment des groupes.
4. **Glisser-déposer** pour réorganiser profils/groupes dans l'arbre
   (`@angular/cdk/drag-drop`, déjà une dépendance peer de `tabby-core`, donc
   pas de nouvelle dépendance à ajouter).

### Suggestion d'ordre d'implémentation

Aucun ordre n'a été validé avec l'utilisateur — à discuter. Un enchaînement
raisonnable serait : favoris → statut live → drag & drop (les 3 restent dans
le composant tree existant, itérables et testables un par un) → SFTP docké
en dernier (le plus gros morceau, nouvelle UI complète).

## Notes diverses

- Nom du dossier sur disque : `tabby-ssh-sidebar`. Nom du package npm déclaré :
  `tabby-sidebar-plus`. Le loader de Tabby utilise le nom du **dossier**, pas
  le champ `name` du package.json — cohérent avec le nom de la jonction créée.
  À harmoniser si le plugin est publié un jour (renommer le dossier ou
  accepter l'incohérence).
- `LICENSE` utilise un copyright placeholder `"tabby-sidebar-plus
  contributors"` — à remplacer par un nom réel si publication un jour.
- Aucun commit git n'a encore été fait (`git config user.name`/`user.email`
  pas configuré, ni localement ni globalement).
