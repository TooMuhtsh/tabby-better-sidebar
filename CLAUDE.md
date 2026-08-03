# tabby-better-sidebar

Plugin pour [Tabby](https://tabby.sh) (terminal SSH/SFTP) : sidebar de profils
enrichie par rapport à la version native — favoris épinglés, statut de
connexion en direct, glisser-déposer, et (à venir) un SFTP contextuel intégré
à l'espace de la sidebar elle-même (pas un panneau docké séparé).

Dépôt distant : https://github.com/TooMuhtsh/tabby-better-sidebar (public).

**Avant toute session de travail sur ce projet, lire `.AIRules/README.html`**
(index + protocole), puis `.AIRules/AI-CONTEXT.html` (invariants, pièges déjà
rencontrés — le prochain numéro libre est indiqué en tête de ce fichier, qui en
est la seule source ; le #7 est un trou hérité de la restructuration doc — et
points fragiles à revérifier après mise à jour de Tabby) et
`.AIRules/AI-HISTORY.html`/`.AIRules/ROADMAP.html` pour l'état d'avancement et
ce qui reste à faire. Ouvrir ces fichiers directement dans un navigateur
(navigation commune entre les 4 pages). Plusieurs bugs Windows/Tabby non
évidents y sont documentés pour ne pas les redécouvrir à chaque fois.

La charte qui régit ce projet est `.AIRules/GOUVERNANCE-IA.md`, version
`20260731-204511` ; **les réponses de cadrage propres à ce projet sont dans
`.AIRules/PROFIL.md`** — s'y reporter plutôt que de redécider une convention au
coup par coup. `.AIRules/GABARITS.md` ne s'ouvre qu'au moment de créer ou de
restructurer un document. Le pied de page de `.AIRules/README.html` porte le même
identifiant : la remise à niveau vers cette version est terminée (voir le chantier
« Conformité de la gouvernance » de la roadmap). En début de session, comparer
malgré tout les deux identifiants — c'est l'écart, pas leur égalité d'aujourd'hui,
qui est le signal.

## Mots déclencheurs

| Mot | Ce qu'il déclenche |
|---|---|
| **`MAJ`** | La chaîne complète en un geste : feu vert d'`A-3`, mise à jour des documents `.AIRules/` concernés, vérification de ce fichier (`A-11`), commit, push. S'arrête à la première étape qui échoue **et dit où** — ne jamais laisser croire à un push qui n'a pas eu lieu. |
| **`GOUVERNANCE`** | Relance l'entretien de cadrage. Seul, il rouvre l'entretien complet ; suivi de clés (`GOUVERNANCE format seuil`), il ne rouvre que celles-là. |

Ils ne déclenchent que lorsqu'ils **constituent l'instruction** — message qui s'y
réduit, ou mot en tête suivi de ses clés. « Il faut revoir la gouvernance de ce
projet » est une phrase, pas un déclencheur. Dans le doute, demander plutôt
qu'exécuter : un déclenchement non voulu écrit et pousse.

`MAJ` demande une vigilance particulière : c'est l'abréviation usuelle de « mise
à jour », donc un mot qui apparaît naturellement dans une phrase ordinaire — « il
faut faire la MAJ du README », « MAJ des dépendances ». Ce sont des demandes de
travail, pas le mot de clôture. Seul un message qui **se réduit** à `MAJ`
déclenche la chaîne.

## Contexte

Tabby a une sidebar de profils native (`profile-tree`, activable dans
Paramètres → Window → "Show profile sidebar") mais elle n'est pas exportée
par `tabby-core`, donc pas réutilisable telle quelle depuis un plugin tiers.
Ce plugin reprend sa logique (adaptée, licence MIT, voir
THIRD-PARTY-NOTICES.md) comme base pour y ajouter les fonctionnalités
demandées.

## Build

```
npm install --ignore-scripts   # --ignore-scripts : évite les postinstall natifs inutiles ici
npm run build                  # ou npm run watch en dev
npm run build:prod             # webpack --mode production ; ce que prepublishOnly appelle
npm run lint:airules           # valide la syntaxe des documents HTML de .AIRules/
```

`build` reste le build de **développement** — c'est celui qu'on veut pour tester
dans Tabby (non minifié, source-map exploitable). `build:prod` n'est là que pour
la publication, où `prepublishOnly` l'appelle tout seul : ne pas publier un
bundle de dev. Il minifie, n'émet **ni source-map ni `pathinfo`**, et retire les
maps qu'un build de dev antérieur aurait laissées dans `dist/`. L'essentiel du
poids restant est les collections d'icônes Iconify — voir le chantier « Ménage
avant release soignée » de la roadmap.

La config webpack **s'exporte en fonction**, et pas en objet : `--mode` arrive
par la ligne de commande, où webpack-cli le fusionne par-dessus la config, si
bien qu'un objet ne peut pas savoir dans quel mode il est construit. Ne pas y
ajouter `output.clean` : les `.d.ts` que `typings` désigne sont écrits dans
`dist/` par TypeScript (`declarationDir`), hors des assets webpack, et un
nettoyage les emporterait.

`lint:airules` est le validateur imposé par `A-14` (option `validateur` du
`PROFIL.md`) : **à lancer après toute modification d'un document `.AIRules/` qui
dépasse une taille triviale**, avant de la considérer terminée. Il couvre aussi
les futurs `annexes/` et `archive/`. Deux règles sont désactivées dans
`.htmlvalidate.json` — `doctype-style` (le `<!doctype html>` minuscule des
documents est valide en HTML5) et `prefer-tbody` (préférence de balisage) : ni
l'une ni l'autre ne détecte une structure cassée, et les satisfaire imposerait de
réécrire en masse des documents dont le journal, qui est en ajout seul.

**`tabby-ssh` ne doit jamais être réinstallé dans `devDependencies`.** Le chargeur de
plugins de Tabby ne met en cache que `tabby-core`, `tabby-local`, `tabby-settings` et
`tabby-terminal` ; tout autre `tabby-*` présent dans le `node_modules` du plugin est
chargé une **seconde fois**, donnant des classes homonymes mais distinctes — `instanceof`
toujours faux, et un `SFTPPanelComponent` dont le `SSHModule` n'a jamais été bootstrappé.
Ses typings sont donc vendorisés dans `src/types/tabby-ssh/` (mappés par `paths` dans
`tsconfig.json`), copiés depuis l'app installée : voir
`src/types/tabby-ssh/PROVENANCE.md` et .AIRules/AI-CONTEXT.html, piège #34.

## Tester dans Tabby

Tabby doit avoir le plugin dans son dossier de plugins installés — **ne pas
utiliser la variable d'env `TABBY_PLUGINS`**, elle est cassée sur Windows
(voir .AIRules/AI-CONTEXT.html, piège #1). À la place, une jonction NTFS déjà en place :

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<ce dossier>"
```

Puis lancer `Tabby.exe` normalement. **Après toute modification, il faut tuer
et relancer tout le process Tabby.exe** (pas juste recharger la fenêtre) —
l'état du chargeur de plugins Node est global au process.

Pour débugger : `Tabby.exe --debug --remote-debugging-port=9333` expose le
protocole Chrome DevTools, accessible via WebSocket natif de Node (voir
.AIRules/AI-CONTEXT.html, piège #8) — utile car Tabby avale silencieusement beaucoup d'erreurs
de chargement de plugin.

## Conventions de code

- Composants Angular : `template: require('./x.pug')`, jamais `templateUrl`
  (ne fonctionne pas pour un plugin tiers — voir .AIRules/AI-CONTEXT.html, piège #3). Pour les
  styles, `import './x.scss'` en side-effect, pas `styleUrls`.
- **Reprendre une classe stylée ailleurs ne reprend rien si son sélecteur est
  descendant d'un autre composant.** Le SCSS étant global, une classe identique
  donne l'illusion du partage : `sidebar-plus-tree .active-sessions
  .active-sessions-header` ne s'applique pas dans un composant frère, et le
  symptôme est un style *partiellement* absent (pas de `display: flex`, donc
  bouton qui tombe à la ligne et `me-auto` sans effet), jamais une erreur. Lire
  le sélecteur complet avant de toucher aux propriétés, et vérifier dans le DOM
  plutôt que de croire un commentaire (.AIRules/AI-CONTEXT.html, piège #56).
- **`:host { ... }` ne fonctionne PAS dans le SCSS de ce plugin** — cible le
  nom du tag custom element (ex: `sidebar-plus-tree { ... }`) à la place. Le
  SCSS étant injecté en CSS globale brute (side-effect import, requis
  ci-dessus), `:host` n'a aucun effet : ni erreur, ni avertissement, le style
  est juste silencieusement ignoré (.AIRules/AI-CONTEXT.html, piège #14).
- `package.json` doit toujours avoir un champ `author` (même vide) —
  son absence fait planter silencieusement la découverte du plugin par Tabby
  (.AIRules/AI-CONTEXT.html, piège #2).
- Versions verrouillées pour matcher Angular 15 (peer dep de `tabby-core`) :
  `typescript@^4.9`, `pug@^2.0`, `@types/node@^18.19`,
  `@ng-bootstrap/ng-bootstrap@^14`. Ne pas monter en majeur sans revérifier
  la compatibilité (.AIRules/AI-CONTEXT.html, piège #4).
- Les typings npm de `tabby-core` sont en retard sur l'app installée
  (`buildGroupTree`, `icon`/`color`/`parentGroupId` sur les groupes) —
  augmentés dans `src/tabby-core-augment.d.ts` plutôt que de disséminer des
  `any`.
- `profilesService.getProfileGroups()`/`getProfiles()` ne garantissent pas un
  clone profond — toujours `structuredClone()` juste après l'appel, avant
  toute mutation (tri, `buildGroupTree()`, etc.), sinon les objets vivants de
  `config.store` peuvent être mutés par erreur et pollués dans `config.yaml`
  au prochain `config.save()` (.AIRules/AI-CONTEXT.html, piège #12 — a réellement corrompu la
  config de production de l'utilisateur une fois, réparée depuis).
- `profilesService.writeProfileGroup()` ne doit **jamais** servir à
  re-parenter un groupe (recherche plate au niveau racine, silencieuse en
  cas d'échec sur un groupe imbriqué). Le re-parentage passe par
  recréation + migration profil par profil + suppression de l'ancien (voir
  .AIRules/AI-CONTEXT.html, piège #12).
- **Ce re-parentage donne au dossier un nouvel id : tout état rangé par id de
  groupe doit migrer dans le même geste**, sinon il retombe à son défaut au
  prochain chargement, sans erreur — `groupOrder` (comme valeur *et* comme clé),
  `hiddenGroupIds`, `favoriteGroups` **des workspaces et du niveau supérieur**,
  et `localStorage.sidebarPlusGroupCollapsed`. Et recopier le groupe *entier*
  moins `id`/`profiles`/`children` plutôt qu'une liste de champs : `defaults`
  est fusionné par Tabby dans chaque profil du dossier, le perdre les dépouille
  en silence (.AIRules/AI-CONTEXT.html, piège #62).
- **Ne jamais écrire un caractère de contrôle brut dans un source** (`'\0'`, pas
  l'octet lui-même) : `rg` et `grep` classent alors tout le fichier comme
  binaire et le sautent **sans le dire**, ce qui a rendu
  `sftpBrowser.component.ts` invisible à toute recherche
  (.AIRules/AI-CONTEXT.html, piège #63).
- **`SFTPSession.stat()` ne sert jamais à observer une entrée** : il rend un mode
  `0` et une date au 1<sup>er</sup> janvier 1970 (piège #50). Toute lecture passe
  par `readRemoteEntry()` (`src/remoteEntry.ts`), qui lit le listing du dossier
  parent. Il ne reste aucun `stat()` d'observation dans `src/` — ne pas en
  réintroduire, y compris pour la question apparemment anodine « ce nom est-il
  libre ? » (`stat()` suit les liens, donc un lien cassé du même nom répond que
  le nom est libre). La seule occurrence restante est la sonde de latence de
  `src/ping.service.ts`, qui s'en sert comme **chronomètre** : rien de la
  réponse n'est lu, seul le temps d'aller-retour compte. Ce n'est pas une
  exception à l'invariant, c'est un autre usage — et le distinguer évite d'y
  voir une régression à la relecture.
- **Un lien symbolique se résout, et c'est la cible qu'on manipule** — chemin
  compris. Travailler sur le chemin du lien faisait tout échouer à la fois :
  copie locale en lecture seule, `chmod 0777` sur la cible au renvoi (le mode
  d'un lien est `0o120777`), détection de conflit morte, et destruction du lien
  par le `unlink` que `upload()` fait avant son `rename`. Résolution par
  `readlink()` + `readRemoteEntry()`, bornée à huit sauts.
- **Une arborescence déposée se lit en bouclant sur `readEntries()`** jusqu'à ce
  qu'il rende un tableau vide : l'API n'en donne qu'une tranche à la fois (100
  entrées sous Chromium) et n'a pas d'autre signal de fin.
  `PlatformService.startUploadFromDragEvent()` — et donc la `dropZone` de
  tabby-core, qui lui délègue — ne l'appelle qu'une fois : au-delà de la première
  tranche, le reste part à la poubelle sans erreur et sans trace
  (.AIRules/AI-CONTEXT.html, piège #64). Ce plugin fait sa propre traversée,
  `readAllEntries()` dans `sftpBrowser.component.ts`.
- **Un même `dragstart` porte deux gestes, et ils ne se partagent pas pareil.** Un
  fichier annonce sa copie vers l'OS par un `DownloadURL`, qui voyage *dans* le
  glisser HTML5 : le type maison `application/x-tabby-sftp-path` s'ajoute à côté
  et le déplacement interne cohabite. Un dossier, lui, réclame
  `preventDefault()` + `webContents.startDrag()` — donc le geste entier, et pas
  de déplacement possible. D'où les deux temps : glisser un dossier le déplace,
  le sortir de la fenêtre sans le déposer démarre sa copie, le geste suivant
  l'emporte. La sortie de fenêtre se lit à l'**âge du dernier `dragover`** reçu
  par le document, jamais à un comptage `dragenter`/`dragleave`.
- **Ne jamais piloter un glisser sur une ligne du panneau SFTP** : le chemin
  sortant appelle `startDrag()`, dont la boucle OLE de Windows attend une vraie
  souris et **gèle le renderer**, CDP compris — seul un `Stop-Process` en sort
  (.AIRules/AI-CONTEXT.html, piège #65). Appeler les handlers à la main, et
  neutraliser le chemin sortant avant de toucher à un dossier. Et ne rien
  conclure de `effectAllowed`/`dropEffect` sur un `DataTransfer` fabriqué : hors
  de leur phase, les affectations sont ignorées sans erreur (piège #66).
- **Un état visuel doit être plus spécifique que le fond qu'il recouvre.** Une
  règle de fond écrite en descendant (`.sftp-grid.with-zebra .sftp-zebra`) pèse
  `(0,3,1)` et bat le survol comme la sélection, à `(0,2,1)` : l'accent est
  calculé puis perdu dans la cascade, et le symptôme est une liste qui ne
  s'allume qu'une ligne sur deux — jamais une erreur. Envelopper la porte dans
  `:where()`, qui n'apporte aucune spécificité. Et vérifier sur les sélecteurs
  **réellement émis dans le bundle**, pas sur le SCSS source.
- **Un composant monté à la main se retire à la main.** Le renderer DOM d'Angular
  laisse `destroyNode` nul, donc `ComponentRef.destroy()` ne touche pas au DOM :
  après `createComponent()` + insertion manuelle, il faut `.remove()` le nœud
  racine avant de détruire, sinon la vue morte reste affichée et le remontage en
  crée une seconde.
- **Tout ce qui part d'un callback Node est hors zone Angular.** zone.js — la
  version navigateur, seule chargée par Tabby — ne patche pas les `EventEmitter`
  de Node : un `fs.watch`, un `http.Server`, une promesse native de russh
  reprennent hors zone, et l'interface ne se repeint pas (piège #41). Envelopper
  les mutations d'état et l'ouverture des modales dans `zone.run()`.
- **Avant toute fonctionnalité touchant `config.store.groups`/`.profiles`,
  tester d'abord sur des entrées jetables** (`grp-zzz-test-*`, ajoutées à la
  main dans `config.yaml` puis supprimées après coup), jamais directement
  sur les vraies données de l'utilisateur — même quand le risque semble
  faible.
- Pour vérifier si une classe/un composant Tabby est utilisable depuis un
  plugin tiers, le tag `/** @hidden */` seul ne prouve rien (n'affecte que la
  doc générée) — vérifier les DEUX niveaux : `typings/index.d.ts` du
  package ET le bloc d'export webpack réel de `dist/index.js` compilé
  (.AIRules/AI-CONTEXT.html, piège #13). Si les typings npm n'exportent pas une classe qui est
  bien réellement exportée à l'exécution (ex: `EditProfileModalComponent` de
  `tabby-settings`), ajouter une augmentation de type dédiée (voir
  `src/tabby-settings-augment.d.ts`, même principe que
  `src/tabby-core-augment.d.ts`) plutôt que de contourner avec des casts
  `any` disséminés — et vérifier les noms de CHAMPS dans le bundle compilé,
  pas seulement dans les typings ni le `.ts` source de l'app (.AIRules/AI-CONTEXT.html, piège
  #17 : un champ peut être nommé différemment entre les typings obsolètes et
  le composant réellement chargé).
- **`@HostListener('document:click')` ignore `$event.stopPropagation()`
  appelé par un descendant.** Ne jamais compter sur la propagation d'un
  clic pour empêcher ce HostListener de se déclencher — vérifier plutôt
  explicitement `(event.target as HTMLElement).closest('.ma-popup, ...')`
  dans le handler lui-même (.AIRules/AI-CONTEXT.html, piège #15).
- **Toute nouvelle clé sous `config.store.sidebarPlus` doit être déclarée
  dans les `defaults` de `SidebarPlusConfigProvider`
  (`src/configProvider.ts`), même vide.** Une clé non déclarée se mute très
  bien en mémoire mais ne persiste jamais dans `config.yaml` — silencieux,
  aucune erreur (.AIRules/AI-CONTEXT.html, piège #16).
- **Un `cdkDropList` vide a une hauteur CSS de 0px**, donc une cible de
  glisser-déposer quasi inatteignable. Le correctif n'est pas un rembourrage
  inconditionnel — il ajoutait de l'espace mort sous chaque dossier — mais un
  agrandissement réservé aux listes `:empty` : `min-height: 16px` +
  `margin-top: -16px` + `pointer-events: none` au repos, la marge négative
  annulant la hauteur dans le flux pendant que la boîte recouvre la moitié basse
  de la ligne au-dessus (.AIRules/AI-CONTEXT.html, pièges #19 et #26).

## Git

Identité configurée **localement** pour ce dépôt (pas globalement) :
`TooMuhtsh <188712716+TooMuhtsh@users.noreply.github.com>` (email noreply
GitHub du compte perso de l'utilisateur). Ne pas committer avec une autre
adresse sans confirmation explicite.

**Métadonnées d'attribution IA : proscrites.** Aucun `Co-Authored-By:`, aucun
`Claude-Session:`, aucune mention d'outil dans un message de commit — y compris
si l'outil les ajoute par défaut. Décision requise une fois par dépôt par la
charte (option `attribution`, `non` depuis le 2026-08-01) ; l'historique
antérieur a été purgé et force-poussé dans le même geste. La trace de la
collaboration IA vit dans `.AIRules/`, qui la porte avec son contexte. À
rediscuter avec l'utilisateur si ce choix doit changer, jamais à trancher au
coup par coup.

**Aucune donnée réelle de l'utilisateur dans un fichier de ce dépôt** — ni nom
d'hôte, ni arborescence de son parc, ni nom d'organisation, y compris dans un
commentaire de code ou un exemple d'affichage. Le dépôt est public, et un
retrait après coup n'est jamais complet : un `push --force` déréférence les
anciens commits sans les supprimer de GitHub (.AIRules/AI-CONTEXT.html, piège
#70). Utiliser un exemple neutre, `app.exemple.fr`. Purge menée le 2026-08-03,
149 commits réécrits.

Le dossier `.AIRules/` se commite et se pousse **à chaque modification**, dans
la foulée du travail qu'il décrit (`A-10`). Le feu vert de l'utilisateur porte
sur le fait d'écrire dans `AI-HISTORY.html`, pas sur le push.

**La roadmap, elle, s'écrit librement** (option `seuil` = `roadmap-libre`,
tranchée le 2026-08-03 en remplacement de `strict`) : corriger une fiche périmée
ou consigner une idée n'attend aucun feu vert. Le motif est un défaut constaté
deux fois — un chantier corrige en passant ce qu'une autre fiche décrit, et
cette fiche-là reste fausse faute d'une autorisation que personne ne pense à
demander. Le journal reste sous validation, et « Fait » continue de reposer sur
un test en conditions réelles.

**Un chantier non abouti vit sur une branche** (option `branches`, tranchée au
cadrage du 2026-07-31 en changement de la pratique antérieure) : sa
documentation l'accompagne et arrive sur `master` avec lui, dans le même merge.
C'est ce qui garantit mécaniquement qu'une gouvernance publiée sur `master` ne
décrit jamais du code absent.

Vérifier la conformité de la copie de la charte par comparaison des blobs Git ou
avec `diff --strip-trailing-cr`, jamais par un `diff` nu — `core.autocrlf` fait
apparaître une divergence totale sur un contenu identique
(.AIRules/AI-CONTEXT.html, piège #47).
