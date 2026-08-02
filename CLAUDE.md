# tabby-better-sidebar

Plugin pour [Tabby](https://tabby.sh) (terminal SSH/SFTP) : sidebar de profils
enrichie par rapport à la version native — favoris épinglés, statut de
connexion en direct, glisser-déposer, et (à venir) un SFTP contextuel intégré
à l'espace de la sidebar elle-même (pas un panneau docké séparé).

Dépôt distant : https://github.com/TooMuhtsh/tabby-better-sidebar (public).

**Avant toute session de travail sur ce projet, lire `.AIRules/README.html`**
(index + protocole), puis `.AIRules/AI-CONTEXT.html` (invariants, pièges déjà
rencontrés — numérotés jusqu'à #58, le #7 est un trou hérité de la
restructuration doc ; le prochain numéro libre est indiqué en tête du fichier —
et points fragiles à revérifier après mise à jour de Tabby) et
`.AIRules/AI-HISTORY.html`/`.AIRules/ROADMAP.html` pour l'état d'avancement et
ce qui reste à faire. Ouvrir ces fichiers directement dans un navigateur
(navigation commune entre les 4 pages). Plusieurs bugs Windows/Tabby non
évidents y sont documentés pour ne pas les redécouvrir à chaque fois.

La charte qui régit ce projet est `.AIRules/GOUVERNANCE-IA.md`, version
`20260731-204511` ; **les réponses de cadrage propres à ce projet sont dans
`.AIRules/PROFIL.md`** — s'y reporter plutôt que de redécider une convention au
coup par coup. `.AIRules/GABARITS.md` ne s'ouvre qu'au moment de créer ou de
restructurer un document. Le pied de page de `.AIRules/README.html` porte encore
une mention datée : c'est voulu, la remise à niveau n'est pas terminée (voir le
chantier « Conformité de la gouvernance » de la roadmap).

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
npm run lint:airules           # valide la syntaxe des documents HTML de .AIRules/
```

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
  glisser-déposer quasi inatteignable — tous les `div[id^='profiles-']` et
  `div[id^='groups-']` ont un `min-height: 8px` pour rester des cibles
  fiables même vides (.AIRules/AI-CONTEXT.html, piège #19).

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

Le dossier `.AIRules/` se commite et se pousse **à chaque modification**, dans
la foulée du travail qu'il décrit (`A-10`). Le feu vert de l'utilisateur porte
sur le fait d'écrire dans `AI-HISTORY.html`/`ROADMAP.html`, pas sur le push.

**Un chantier non abouti vit sur une branche** (option `branches`, tranchée au
cadrage du 2026-07-31 en changement de la pratique antérieure) : sa
documentation l'accompagne et arrive sur `master` avec lui, dans le même merge.
C'est ce qui garantit mécaniquement qu'une gouvernance publiée sur `master` ne
décrit jamais du code absent.

Vérifier la conformité de la copie de la charte par comparaison des blobs Git ou
avec `diff --strip-trailing-cr`, jamais par un `diff` nu — `core.autocrlf` fait
apparaître une divergence totale sur un contenu identique
(.AIRules/AI-CONTEXT.html, piège #47).
