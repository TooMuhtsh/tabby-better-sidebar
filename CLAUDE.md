# tabby-better-sidebar

Plugin pour [Tabby](https://tabby.sh) (terminal SSH/SFTP) : sidebar de profils
enrichie par rapport à la version native — favoris épinglés, statut de
connexion en direct, glisser-déposer, et un gestionnaire SFTP docké façon
FileZilla (pas de fenêtre flottante).

Dépôt distant : https://github.com/TooMuhtsh/tabby-better-sidebar (public).

**Voir `tabby_sidebar_roadmap.md` dans ce dossier pour l'état d'avancement
détaillé, les pièges déjà rencontrés (14 à ce jour) et la liste précise de ce
qui reste à faire.** Le lire avant de commencer toute session de travail sur
ce projet — plusieurs bugs Windows/Tabby non évidents y sont documentés pour
ne pas les redécouvrir à chaque fois. Voir aussi la section "Points fragiles
à revérifier après une mise à jour de Tabby" du même fichier.

## Contexte

Tabby a une sidebar de profils native (`profile-tree`, activable dans
Paramètres → Window → "Show profile sidebar") mais elle n'est pas exportée
par `tabby-core`, donc pas réutilisable telle quelle depuis un plugin tiers.
Ce plugin reprend sa logique (adaptée, licence MIT, voir
THIRD-PARTY-NOTICES.md) comme base pour y ajouter les fonctionnalités
demandées.

## Build

```
npm install --ignore-scripts   # --ignore-scripts : tabby-ssh a un postinstall natif inutile ici
npm run build                  # ou npm run watch en dev
```

## Tester dans Tabby

Tabby doit avoir le plugin dans son dossier de plugins installés — **ne pas
utiliser la variable d'env `TABBY_PLUGINS`**, elle est cassée sur Windows
(voir roadmap, piège #1). À la place, une jonction NTFS déjà en place :

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<ce dossier>"
```

Puis lancer `Tabby.exe` normalement. **Après toute modification, il faut tuer
et relancer tout le process Tabby.exe** (pas juste recharger la fenêtre) —
l'état du chargeur de plugins Node est global au process.

Pour débugger : `Tabby.exe --debug --remote-debugging-port=9333` expose le
protocole Chrome DevTools, accessible via WebSocket natif de Node (voir
roadmap, piège #8) — utile car Tabby avale silencieusement beaucoup d'erreurs
de chargement de plugin.

## Conventions de code

- Composants Angular : `template: require('./x.pug')`, jamais `templateUrl`
  (ne fonctionne pas pour un plugin tiers — voir roadmap, piège #3). Pour les
  styles, `import './x.scss'` en side-effect, pas `styleUrls`.
- **`:host { ... }` ne fonctionne PAS dans le SCSS de ce plugin** — cible le
  nom du tag custom element (ex: `sidebar-plus-tree { ... }`) à la place. Le
  SCSS étant injecté en CSS globale brute (side-effect import, requis
  ci-dessus), `:host` n'a aucun effet : ni erreur, ni avertissement, le style
  est juste silencieusement ignoré (roadmap, piège #14).
- `package.json` doit toujours avoir un champ `author` (même vide) —
  son absence fait planter silencieusement la découverte du plugin par Tabby
  (roadmap, piège #2).
- Versions verrouillées pour matcher Angular 15 (peer dep de `tabby-core`) :
  `typescript@^4.9`, `pug@^2.0`, `@types/node@^18.19`,
  `@ng-bootstrap/ng-bootstrap@^14`. Ne pas monter en majeur sans revérifier
  la compatibilité (roadmap, piège #4).
- Les typings npm de `tabby-core` sont en retard sur l'app installée
  (`buildGroupTree`, `icon`/`color`/`parentGroupId` sur les groupes) —
  augmentés dans `src/tabby-core-augment.d.ts` plutôt que de disséminer des
  `any`.
- `profilesService.getProfileGroups()`/`getProfiles()` ne garantissent pas un
  clone profond — toujours `structuredClone()` juste après l'appel, avant
  toute mutation (tri, `buildGroupTree()`, etc.), sinon les objets vivants de
  `config.store` peuvent être mutés par erreur et pollués dans `config.yaml`
  au prochain `config.save()` (roadmap, piège #12 — a réellement corrompu la
  config de production de l'utilisateur une fois, réparée depuis).
- `profilesService.writeProfileGroup()` ne doit **jamais** servir à
  re-parenter un groupe (recherche plate au niveau racine, silencieuse en
  cas d'échec sur un groupe imbriqué). Le re-parentage passe par
  recréation + migration profil par profil + suppression de l'ancien (voir
  roadmap, piège #12).
- **Avant toute fonctionnalité touchant `config.store.groups`/`.profiles`,
  tester d'abord sur des entrées jetables** (`grp-zzz-test-*`, ajoutées à la
  main dans `config.yaml` puis supprimées après coup), jamais directement
  sur les vraies données de l'utilisateur — même quand le risque semble
  faible.
- Pour vérifier si une classe/un composant Tabby est utilisable depuis un
  plugin tiers, le tag `/** @hidden */` seul ne prouve rien (n'affecte que la
  doc générée) — vérifier les DEUX niveaux : `typings/index.d.ts` du
  package ET le bloc d'export webpack réel de `dist/index.js` compilé
  (roadmap, piège #13). Si les typings npm n'exportent pas une classe qui est
  bien réellement exportée à l'exécution (ex: `EditProfileModalComponent` de
  `tabby-settings`), ajouter une augmentation de type dédiée (voir
  `src/tabby-settings-augment.d.ts`, même principe que
  `src/tabby-core-augment.d.ts`) plutôt que de contourner avec des casts
  `any` disséminés — et vérifier les noms de CHAMPS dans le bundle compilé,
  pas seulement dans les typings ni le `.ts` source de l'app (roadmap, piège
  #17 : un champ peut être nommé différemment entre les typings obsolètes et
  le composant réellement chargé).
- **`@HostListener('document:click')` ignore `$event.stopPropagation()`
  appelé par un descendant.** Ne jamais compter sur la propagation d'un
  clic pour empêcher ce HostListener de se déclencher — vérifier plutôt
  explicitement `(event.target as HTMLElement).closest('.ma-popup, ...')`
  dans le handler lui-même (roadmap, piège #15).
- **Toute nouvelle clé sous `config.store.sidebarPlus` doit être déclarée
  dans les `defaults` de `SidebarPlusConfigProvider`
  (`src/configProvider.ts`), même vide.** Une clé non déclarée se mute très
  bien en mémoire mais ne persiste jamais dans `config.yaml` — silencieux,
  aucune erreur (roadmap, piège #16).
- **Un `cdkDropList` vide a une hauteur CSS de 0px**, donc une cible de
  glisser-déposer quasi inatteignable — tous les `div[id^='profiles-']` et
  `div[id^='groups-']` ont un `min-height: 8px` pour rester des cibles
  fiables même vides (roadmap, piège #19).

## Git

Identité configurée **localement** pour ce dépôt (pas globalement) :
`TooMuhtsh <188712716+TooMuhtsh@users.noreply.github.com>` (email noreply
GitHub du compte perso de l'utilisateur). Ne pas committer avec une autre
adresse sans confirmation explicite.
