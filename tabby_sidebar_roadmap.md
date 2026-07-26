# Roadmap — tabby-better-sidebar

Plugin Tabby : sidebar de profils enrichie (favoris, statut live, drag & drop,
SFTP docké façon FileZilla) — construit à partir du composant `profile-tree`
natif de Tabby (MIT, voir THIRD-PARTY-NOTICES.md).

Dépôt local : `C:\Users\Alex Ramirez\Documents\Développement\tabby-ssh-sidebar`
(le dossier a gardé son nom historique — voir "Notes diverses").
Dépôt distant : **https://github.com/TooMuhtsh/tabby-better-sidebar** (public).

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
- **Renommage** `tabby-sidebar-plus` → `tabby-better-sidebar` (package.json,
  README, jonction de dev dans `%APPDATA%\tabby\plugins\node_modules\`).
- **Favoris épinglés** (`src/configProvider.ts`, `src/components/sidebarTree.component.ts/.pug/.scss`) :
  section « Épinglés » (`fas fa-star`) injectée en tête de `rootGroups`
  quand au moins un favori existe, construite depuis
  `config.store.sidebarPlus.favorites` (tableau d'IDs de profil). Le profil
  reste aussi visible à son emplacement normal dans son groupe (pas de retrait),
  avec un badge étoile (`.favorite-badge`) dans les deux emplacements. Toggle
  via une action dans la barre d'actions au survol (icône `fas`/`far fa-star`
  selon l'état), persistée avec `config.save()`. Testé de bout en bout via le
  protocole CDP (voir piège #8) : toggle on/off, apparition/disparition de la
  section, écriture correcte dans `config.yaml` (`sidebarPlus.favorites`).
- **Statut de connexion live** (`src/components/sidebarTree.component.ts/.pug/.scss`) :
  petit point coloré (`.status-dot`) à côté de chaque profil — vert
  (`status-dot-connected`) si un onglet ouvert a une session active
  (`tab.session` non-null), rouge (`status-dot-error`) si un onglet existe
  pour ce profil mais sans session (déconnecté/échec), gris/atténué sinon
  (aucun onglet). Calculé en aplatissant `AppService.tabs` (via
  `SplitTabComponent.getAllTabs()` pour descendre dans les onglets scindés)
  et en lisant `tab.profile.id`/`tab.session` en duck-typing (ces champs
  existent sur `BaseTerminalTabComponent` mais pas sur `BaseTabComponent`
  générique — pas de bon type commun dans les typings publics). Recalculé sur
  `tabsChanged$`/`tabOpened$`/`tabClosed$`/`tabRemoved$` **et** un `timer`
  RxJS toutes les 2s en complément (un onglet existant peut changer d'état —
  ex: reconnexion — sans déclencher ces events ; pas de vrai health-check
  réseau, juste une relecture locale de `tab.session`, coût nul). Testé de
  bout en bout via CDP : onglet PowerShell restauré au démarrage passe bien
  de rouge (session pas encore prête) à vert en ~2s, un profil SSH factice
  (IP injoignable) passe correctement au rouge après l'échec de connexion.
- **Glisser-déposer** (`src/index.ts` : `DragDropModule` ajouté aux imports ;
  `src/components/sidebarTree.component.ts/.pug/.scss`) :
  - **Profils** : réutilise le champ natif `Profile.weight` (déjà utilisé par
    Tabby pour trier son propre sélecteur rapide Ctrl+Shift+P) comme clé de
    tri au sein d'un groupe (`group.profiles.sort by weight`, absent
    auparavant — les profils n'étaient triés par aucun critère explicite).
    Réordonner dans un groupe ou déplacer vers un autre groupe (y compris
    vers/depuis "Sans groupe") réécrit `profile.weight`/`profile.group` via
    `profilesService.writeProfile()` + `config.save()`. Chaque groupe a sa
    propre `cdkDropList` (id `profiles-{groupId}`), toutes connectées entre
    elles via `[cdkDropListConnectedTo]='profileListIds'` (liste calculée
    depuis `profileGroups`) pour permettre le déplacement inter-groupes.
  - **Groupes** : réordonnancement entre frères (même niveau/parent)
    uniquement, testé et fiable. Persisté dans
    `config.store.sidebarPlus.groupOrder[parentGroupId ?? 'root']` (tableau
    d'IDs), car `ProfileGroup` n'a pas d'équivalent natif à `Profile.weight`.
    `cdkDropList` par niveau (racine + un par `group.children`), **non
    connectées entre elles** (pas de `[cdkDropListConnectedTo]`).
    **Le re-parentage (glisser un groupe vers un autre parent, ou vers/depuis
    la racine) a été tenté puis retiré — voir piège #12, dangereux pour les
    données réelles de l'utilisateur.**
  - Groupes non éditables (`built-in`, `ungrouped`, les pseudo-groupes
    `search`/`favorites`) : `cdkDragDisabled` sur leur en-tête, et
    `onProfileDrop`/`onGroupDrop` no-opent si la cible n'est pas éditable
    (exception : `ungrouped` reste une cible valide pour un *profil*, pas
    pour un *groupe*).
  - **Piège de test découvert** : simuler un `MouseEvent` de drag via CDP
    nécessite explicitement `buttons: 1` sur les événements `mousedown`/
    `mousemove` (sans ce bit, Angular CDK ignore silencieusement le drag,
    croyant le bouton relâché — la valeur par défaut du constructeur
    `MouseEvent` est `buttons: 0`). Idem, une `cdkDropList` vide (0 profil)
    a une hauteur CSS de 0px et n'est quasiment pas atteignable comme cible
    de drop avec des coordonnées de souris simulées ; une astuce de test a
    consisté à lui donner temporairement un `min-height` inline avant de
    drag-and-drop dessus. Testé de bout en bout via CDP sur les **vrais
    profils SSH de production de l'utilisateur** (infra Travail.fr) :
    réordonnancement intra-groupe de profils, déplacement de profils
    inter-groupes, réordonnancement de groupes frères (y compris imbriqués,
    ex. INFRA → ATRIA/DATACENTER) — écriture confirmée dans `config.yaml`
    (`weight`, `group`, `groupOrder`), état restauré à l'identique après
    chaque test.
  - **Bugs UX corrigés après retour utilisateur** :
    - Les boutons Play/Étoile de la barre d'actions au survol restaient
      visibles dans l'aperçu de drag d'un profil (le clone suit le curseur,
      qui reste donc visuellement "au-dessus" de l'élément → son `:hover`
      matche réellement). Une règle `.cdk-drag-preview .actions{display:none
      !important}` était censée corriger ça mais ne matchait jamais : elle
      était imbriquée sous `.sidebar-plus-tree` en SCSS, or CDK déplace
      l'aperçu dans un overlay global attaché à `<body>`, **hors de cet
      arbre DOM** — un sélecteur ancêtre-scoped ne peut jamais matcher un
      élément relocalisé ailleurs dans le DOM. → Toutes les règles
      `.cdk-drag-preview`/`.cdk-drag-placeholder`/`.group-drag-preview` ont
      été sorties du bloc `.sidebar-plus-tree { }` vers la racine du fichier.
    - L'aperçu de drag d'un groupe affichait tout son sous-arbre (profils et
      sous-groupes inclus) car CDK clone par défaut l'intégralité de
      l'élément `cdkDrag`. → Ajout d'un template `*cdkDragPreview` dédié
      (icône + nom seulement) sur le wrapper de groupe.
- **Suppression de groupe par clic droit** (`src/components/sidebarTree.component.ts/.pug/.scss`) :
  menu contextuel minimaliste (pas de dépendance ajoutée, juste un `div`
  positionné en `fixed` aux coordonnées du clic, fermé au clic extérieur via
  un `@HostListener('document:click')`). Garde-fou : si le groupe contient
  encore des sous-groupes ou des profils, la suppression est refusée avec un
  message explicite via `NotificationsService.error()` (ex: "Ce dossier
  contient encore 1 sous-dossier et 3 profils. Videz-le d'abord."). Testé
  via CDP sur des groupes jetables créés spécialement pour l'occasion
  (`grp-zzz-test-delete-*`, jamais sur les vrais groupes de l'utilisateur) :
  refus correct sur un groupe non-vide, suppression + persistance correcte
  sur un groupe vide, `config.yaml` toujours propre après coup.
- **Re-parentage de groupe par glisser-déposer** (`src/components/sidebarTree.component.ts/.pug`) :
  réactivé après avoir été retiré (piège #12) — cette fois via **recréation +
  déplacement**, jamais via `writeProfileGroup()`. `onGroupDrop()` détecte un
  déplacement inter-conteneurs (`event.previousContainer !== event.container`)
  et appelle `reparentGroup(group, newParentId)` :
  1. `profilesService.newProfileGroup({name, icon, color, parentGroupId},
     {genId:true})` — crée un groupe équivalent sous le nouveau parent.
  2. Pour chaque profil du groupe d'origine : `profile.group = newId` +
     `writeProfile(profile)` (déplacement un par un, mécanisme déjà éprouvé
     pour le drag&drop de profils).
  3. Récursion sur `group.children` (sous-dossiers imbriqués recréés sous le
     nouveau groupe, récursivement, avant que leurs propres profils/enfants
     ne soient à leur tour déplacés).
  4. `profilesService.deleteProfileGroup(group)` — l'ancien groupe, maintenant
     vide, est supprimé (même mécanisme fiable que la suppression manuelle).
  Toutes les cdkDropList de groupes sont reconnectées entre elles via
  `[cdkDropListConnectedTo]='groupListIds'` (racine + une par
  `group.children`, `groupListIds` calculé depuis `profileGroups`).
  Protection anti-cycle via `isSelfOrDescendant()` (impossible de déposer un
  groupe dans l'un de ses propres descendants). En cas d'échec à une étape,
  `NotificationsService.error()` prévient l'utilisateur au lieu d'échouer
  silencieusement.
  - **Piège de test** : `config.save()` n'était pas `await`-é dans le
    gestionnaire — sans conséquence visible pour les autres actions du
    plugin (le fire-and-forget avait toujours le temps de se terminer avant
    la prochaine vérification), mais a fait perdre du temps de debug ici en
    faisant croire à un échec silencieux de `reparentGroup()` alors que
    l'opération avait en fait bien réussi en mémoire. Corrigé : `await
    this.config.save()` partout dans ce composant.
  - **Piège de test CDP** : une `cdkDropList` cible vide (0 enfant) a une
    hauteur CSS de 0px — un premier test de glisser-déposer vers un groupe
    racine vide a été interprété par CDK comme un réordonnancement **dans
    la liste d'origine** (`event.previousContainer === event.container`)
    plutôt qu'un déplacement inter-conteneurs, car les coordonnées de la
    souris simulée ne "touchaient" jamais la zone de drop quasi-invisible.
    Donner temporairement une hauteur généreuse (`min-height: 100px`) à la
    cdkDropList cible avant de simuler le drag a résolu le problème de test
    (déjà rencontré pour les profils, revu ici en plus sévère avec des
    groupes vides).
  Testé de bout en bout sur des groupes jetables (`grp-zzz-test-move-*`,
  y compris un sous-groupe imbriqué à 2 niveaux pour valider la récursion) :
  nouveaux UUID générés, `parentGroupId` correct à chaque niveau, anciennes
  entrées bien supprimées, aucune duplication ni pollution de `config.yaml`.
- **Édition de profil par clic droit** (`src/components/sidebarTree.component.ts/.pug`) :
  menu contextuel « Éditer... » sur un profil (même mécanisme UI que le menu
  contextuel des groupes, dupliqué avec un state séparé
  `contextMenuProfile`). N'appelle **jamais** directement la modale native
  d'édition : `EditProfileModalComponent` (tabby-settings) et
  `SSHProfileSettingsComponent` (tabby-ssh) sont toutes deux marquées
  `@hidden` et absentes du bundle webpack exporté (vérifié aux deux niveaux :
  `typings/index.d.ts` ET le bloc d'export runtime de `dist/index.js`) — même
  situation que `profile-tree`, non réutilisables depuis un plugin tiers sans
  réimplémentation complète du formulaire (host/port/user/auth/clés privées/
  proxy/jump hosts/algorithmes...). `openProfileSettings(profile)` fait
  plutôt, en deux temps :
  1. Ouvre/réutilise l'onglet natif **Paramètres → Profils et connexions**
     via `AppService.openNewTabRaw({ type: SettingsTabComponent, inputs: {
     activeTab: 'profiles' } })` — `SettingsTabComponent` est bien exporté
     publiquement par `tabby-settings` (contrairement à la modale d'édition)
     et accepte un `@Input() activeTab` pour cibler directement le sous-onglet
     Profils.
  2. **Pilote ensuite le DOM natif** (`clickNativeProfileRow()`) pour ouvrir
     la modale d'édition du bon profil sans intervention de l'utilisateur :
     après un court délai (rendu Angular async), **déplie tous les groupes
     repliés** de la liste native (plusieurs passes : cherche les
     `.collapse-item` dont l'icône est `fa-folder` sans `fa-folder-open`
     — càd repliés — et clique dessus, jusqu'à ce qu'il n'en reste plus,
     car déplier un groupe peut en révéler un autre encore replié en
     dessous), puis cherche la ligne `.collapse-item` dont le texte
     correspond exactement au nom du profil et lui envoie un `.click()`
     natif — **c'est le clic sur la ligne elle-même qui ouvre la modale
     d'édition**, il n'y a pas de bouton "Éditer" dédié (le menu déroulant
     kebab ne contient que Dupliquer/Masquer/Supprimer, vérifié en
     l'inspectant avant d'écrire le code pour ne jamais risquer de cliquer
     "Supprimer" par erreur). Ne passe plus par la barre de recherche
     `input[type="search"]` (approche initiale abandonnée : chercher/cliquer
     directement la ligne suffit et est plus simple — mais nécessitait ce
     dépliage systématique, sinon la ligne cible n'existe simplement pas
     dans le DOM tant que son groupe parent est replié).
  Ce point 2 est un contournement DOM explicitement choisi après validation
  utilisateur (accepté malgré le risque de casse silencieuse à une future
  mise à jour de Tabby — voir section dédiée "Points fragiles..." plus bas).
  Limite connue : si plusieurs profils partagent EXACTEMENT le même nom
  affiché, seule la première ligne trouvée est ciblée. Si l'onglet
  Paramètres est déjà ouvert, le code le réutilise (`app.selectTab`) plutôt
  que d'en empiler un nouveau — et dans ce cas (onglet déjà ouvert par
  l'utilisateur pour une autre raison), **pas de fermeture/retour
  automatique** : cette gestion n'a lieu que si le plugin a lui-même créé
  l'onglet, pour ne jamais fermer un onglet Paramètres qui n'est pas "le
  nôtre".
  - **Retour automatique + toast** (`watchForNativeModalClose()`) : quand
    c'est le plugin qui a ouvert l'onglet Paramètres, un `setInterval` (300ms,
    nettoyé dans `ngOnDestroy`, timeout de sécurité à 10 min) surveille la
    disparition de `.modal-content` après l'avoir vue apparaître au moins
    une fois. Dès que la modale se ferme (Enregistrer **ou** Annuler — les
    deux cas ne sont pas distingués, un retour est utile dans les deux),
    l'onglet Paramètres est fermé (`app.closeTab`) et l'onglet actif
    précédent (capturé via `app.activeTab` avant l'ouverture) est
    resélectionné, avec `NotificationsService.notice('Retour à votre
    session précédente')`.
  Testé de bout en bout via CDP sur un profil volontairement niché dans un
  groupe replié ("AdGuard" sous Maison → SSH, tous deux repliés par défaut
  dans la liste native) : clic droit dans notre sidebar → « Éditer... » →
  dépliage automatique → modale ouverte avec le bon titre → Annuler →
  onglet Paramètres refermé automatiquement → retour sur l'onglet d'origine
  → toast affiché.
- **Glissoir de redimensionnement pleine hauteur + fix `:host` (piège #14)**
  (`src/components/sidebarTree.component.scss`) — l'utilisateur signalait ne
  pas voir/pouvoir utiliser le glissoir de redimensionnement (auparavant une
  petite poignée de 25px de haut centrée verticalement). En creusant, un bug
  bien plus large a été découvert : **`:host { ... }` ne s'appliquait jamais
  du tout**, ni pour le glissoir ni pour le fond/la bordure de la sidebar.
  Cause : ce plugin injecte son SCSS en CSS globale brute (side-effect
  `import './x.scss'`, requis pour un plugin tiers — voir piège #3, les
  `styleUrls` ne marchent pas). Or `:host` est un pseudo-sélecteur qui n'a de
  sens QUE traité par le compilateur de templates Angular (transformé en
  `[_nghost-xxx]`) ou en Shadow DOM natif — aucun des deux ne s'applique ici,
  donc le navigateur ignore silencieusement la règle. Conséquence concrète :
  `.grabber` (`position: absolute`) n'avait aucun ancêtre positionné pour
  s'ancrer, et se positionnait donc relativement au **viewport entier** —
  d'où un glissoir invisible, à un endroit aléatoire loin de la sidebar.
  → **Fix** : remplacer `:host { ... }` par `sidebar-plus-tree { ... }` (le
  tag de l'élément hôte, en CSS globale normale — fonctionne car c'est un
  vrai sélecteur, contrairement à `:host`). Le glissoir est aussi passé
  d'une poignée `height: 25px` centrée à une bande `height: 100%` sur toute
  la hauteur, avec surbrillance au survol (`background-color` transparente
  par défaut, colorée au `:hover`/pendant le drag via `[class.resizing]`)
  pour le rendre découvrable sans avoir à viser un point précis.
  Testé via CDP : `getComputedStyle` confirme `position: relative` sur
  `<sidebar-plus-tree>` après le fix (`static` avant), le glissoir est
  désormais l'élément au sommet (`elementFromPoint` le retourne, alors
  qu'avant un tout autre élément répondait à cette position), et un
  redimensionnement déclenché près du bas du glissoir (pas au centre)
  fonctionne. Bonus : le fond et la bordure de la sidebar (`background-color`,
  `border-right`), eux aussi dans le bloc `:host` cassé, s'appliquent enfin
  visuellement.
- **Masquage du groupe "Sans groupe" (Ungrouped) quand il est vide**
  (`src/components/sidebarTree.component.ts`, `loadTreeItems()`) — un filtre
  d'une ligne (`groups = groups.filter(g => g.id !== 'ungrouped' ||
  (g.profiles?.length ?? 0) > 0)`), aucun risque particulier, ne touche que
  l'affichage. Testé : le groupe disparaît bien de l'arbre racine quand
  aucun profil n'y est rattaché.
- **Git configuré et poussé sur GitHub** : `gh` CLI installé en version
  portable (zip, `%LOCALAPPDATA%\Programs\gh-portable`, pas d'admin requis),
  authentifié en tant que `TooMuhtsh` (compte perso). Dépôt public créé et
  code poussé : https://github.com/TooMuhtsh/tabby-better-sidebar (2 commits
  sur `master`). Identité des commits : `TooMuhtsh
  <188712716+TooMuhtsh@users.noreply.github.com>` (email noreply GitHub —
  les 2 premiers commits avaient été faits par erreur avec l'email pro de
  l'utilisateur, réécrits ensuite, voir pièges ci-dessous).

## Pièges rencontrés (à ne pas refaire)

1. **`TABBY_PLUGINS` casse sur Windows.** Le loader de Tabby fait
   `process.env.TABBY_PLUGINS.split(':')` (mécanisme façon `$PATH` Unix) —
   un chemin Windows absolu (`C:\Users\...`) contient un `:` juste après la
   lettre de lecteur, donc le chemin est tronqué et le plugin n'est jamais
   trouvé, **sans erreur visible**. C'est un bug de Tabby, pas de notre code.
   → **Solution retenue** : ne pas utiliser `TABBY_PLUGINS` du tout. Créer une
   jonction NTFS du dossier du plugin directement dans
   `%APPDATA%\tabby\plugins\node_modules\tabby-better-sidebar` (le même
   emplacement où vivent les plugins installés comme SFTP+). Commande :
   ```powershell
   New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "C:\Users\Alex Ramirez\Documents\Développement\tabby-ssh-sidebar"
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
9. **`gh auth login` authentifie le compte connecté dans le navigateur, pas
   un compte qu'on choisit dans le CLI.** Le flux "device login" ouvre juste
   une page où on entre un code ; c'est le compte GitHub déjà actif dans le
   navigateur (ou celui sélectionné manuellement à ce moment) qui approuve.
   Si plusieurs comptes GitHub existent, vérifier lequel est actif dans le
   navigateur AVANT de lancer `gh auth login`, ou faire
   `gh auth status --active` après coup pour confirmer.
10. **Après-coup, l'auteur des commits ≠ le compte GitHub utilisé.** Même
    repo créé sous le bon compte GitHub (`TooMuhtsh`), les commits peuvent
    afficher une tout autre identité si `git config user.email` a été réglé
    avec une autre adresse (ici l'email pro de l'utilisateur, utilisé par
    défaut faute de correction au moment du premier commit). Les deux
    identités (compte GitHub qui pousse vs. auteur du commit) sont
    totalement indépendantes — à vérifier séparément.
    → Email noreply GitHub officiel pour committer "en tant que" un compte
    perso sans exposer d'adresse réelle :
    `{id}+{login}@users.noreply.github.com` (id récupérable via
    `gh api user --jq '{id, login}'`).
11. **Réécriture d'historique (`git filter-branch`) bloquée par le mode auto
    de Claude Code.** Le classificateur de permissions refuse cette action
    (jugée sensible) même si le repo est personnel et sans collaborateurs.
    → Il faut que l'utilisateur lance lui-même la commande via le préfixe
    `!` dans le chat (ça s'exécute dans sa session, hors du sandbox
    classifié). Après réécriture, un `git push --force` est nécessaire
    puisque les hash de commit changent.
12. **`getProfileGroups()` ne clone pas profondément → toute mutation faite
    par le plugin (même `buildGroupTree()`) pollue `config.yaml` au save
    suivant. Cause racine, critique, à ne jamais réintroduire.** Découvert
    en tentant d'implémenter le re-parentage de groupe par glisser-déposer,
    mais **le problème n'a rien à voir avec le drag & drop en soi** : il se
    déclenche dès qu'un `config.save()` a lieu (favoris, réordonnancement,
    suppression, n'importe quoi) *après* que `loadTreeItems()` a construit
    l'arbre d'affichage.
    - `this.profilesService.getProfileGroups({...})` ne garantit pas un clone
      profond (contrairement à `getProfiles({clone:true})`, qui lui clone
      bien). Les objets `ProfileGroup` renvoyés sont potentiellement des
      **références directes** vers les objets vivants de
      `config.store.groups`.
    - Notre `loadTreeItems()` appelle ensuite
      `this.profilesService.buildGroupTree(this.profileGroups)`, qui
      **attache un tableau `.children` calculé directement sur ces mêmes
      objets** (annotation en place, pas de copie) pour construire l'arbre
      d'affichage imbriqué.
    - Résultat : les objets de `config.store.groups` se retrouvent avec une
      propriété `.children` supplémentaire (contenant les sous-groupes ET
      leurs profils, imbriqués) qui n'existait pas dans le modèle natif de
      Tabby. Au prochain `config.save()` (qu'il vienne de notre plugin ou
      d'ailleurs dans l'app), cette propriété polluante est sérialisée dans
      `config.yaml`, produisant un YAML avec des groupes dupliqués : une
      fois nichés sous leur parent (avec profils dupliqués), une fois en
      entrée plate au niveau racine — et si en plus un champ comme
      `parentGroupId` est modifié sur l'objet partagé (ex: par un
      `writeProfileGroup()`, voir plus bas), le save suivant peut aussi
      perdre ou déplacer des groupes de façon incohérente.
    - Constaté concrètement en testant le re-parentage de "SSH" (sortir du
      groupe "Maison") : le groupe "ATRIA" (jamais touché directement) s'est
      retrouvé orphelin (`parentGroupId` perdu) et 5 groupes frères
      (DATACENTER, HOSTS, Proxmox, vSphere, Services) ont perdu leur entrée
      plate correcte — **sur la config réelle de production de
      l'utilisateur**. Réparée à la main (aucune perte de profil : les
      profils référencent toujours leur groupe par un simple champ
      `group: <id>` indépendant du modèle de groupe, seule la métadonnée de
      hiérarchie des groupes était touchée). Le problème s'est reproduit une
      2e fois sur un simple toggle de favori, confirmant que ce n'était pas
      spécifique au drag & drop.
    → **Fix appliqué (retenu définitivement)** : dans `loadTreeItems()`,
    cloner `groups` avec `structuredClone()` juste après l'appel à
    `getProfileGroups()`, avant toute manipulation (filtrage, tri,
    `buildGroupTree()`). Ainsi le plugin ne mute jamais que sa propre copie,
    quels que soient les objets renvoyés par l'API de Tabby. Vérifié après
    coup : plusieurs `config.save()` déclenchés (favoris, suppression de
    groupe) sans aucune pollution de `config.yaml`.
    → **Le re-parentage de groupes par glisser-déposer a été réintroduit**
    (voir section "Fait" plus haut), mais sans jamais utiliser
    `profilesService.writeProfileGroup(group)` — cette méthode fait
    `config.store.groups.find(g => g.id === group.id)` — une recherche
    **plate, uniquement au niveau racine** — donc reste fondamentalement
    inadaptée pour déplacer un groupe entre `children:` imbriqués (silencieux
    en cas d'échec, ne nettoie jamais l'ancien emplacement). À la place :
    recréation (`newProfileGroup`) + déplacement des profils un par un
    (`writeProfile`) + suppression de l'ancien (`deleteProfileGroup`) — trois
    opérations individuellement déjà éprouvées fiables. Le réordonnancement
    entre groupes frères (même parent) reste, lui, géré séparément via
    `config.store.sidebarPlus.groupOrder` (espace propre au plugin, jamais
    `config.store.groups`).
    → Piège annexe : toute édition manuelle de `config.yaml` doit se faire
    **avec Tabby fermé** (sinon le prochain `config.save()` réécrit le
    fichier et écrase la correction) ; l'édition de fichiers hors du dossier
    du projet (`%APPDATA%\tabby\...`) est bloquée par le classificateur de
    permissions du mode auto — l'utilisateur doit approuver explicitement.
    → Piège de méthode : pour toute future fonctionnalité touchant aux
    groupes/profils, **toujours tester d'abord sur des entrées jetables**
    (ex: `grp-zzz-test-*`, ajoutées à la main dans `config.yaml` puis
    supprimées après coup) plutôt que sur les vraies données de
    l'utilisateur, même quand le risque semble faible.
13. **Le commentaire `/** @hidden */` sur une classe Tabby ne veut PAS dire
    "non exportée" — les deux sont indépendants, toujours vérifier l'export
    réel.** Découvert en cherchant à ouvrir la modale native d'édition de
    profil : `EditProfileModalComponent` (tabby-settings) est `@hidden` ET
    absente du bloc d'export webpack réel de `dist/index.js` (inutilisable
    depuis un plugin tiers) — mais `SettingsTabComponent` (même package) est
    **elle aussi** `@hidden` dans ses typings, et pourtant bel et bien
    présente dans `typings/index.d.ts` (`export { SettingsTabComponent }`)
    ET dans le bloc d'export webpack réel de `dist/index.js`. `@hidden` ne
    sert qu'à exclure une classe de la doc générée ; ça n'a aucun effet sur
    ce qui est réellement exporté par le module. → Pour savoir si une classe
    est utilisable depuis un plugin tiers, vérifier les DEUX niveaux : (a)
    `typings/index.d.ts` du package (`export { X }` ou `export * from`), ET
    (b) le bloc `__webpack_require__.d(__webpack_exports__, {...})` du
    module d'entrée dans `dist/index.js` compilé — les typings peuvent
    parfois être en avance/retard sur le runtime réel (voir aussi piège #6).
    Ne jamais conclure "non exporté" sur la seule présence de `@hidden`.
14. **`:host { ... }` ne fonctionne PAS dans le SCSS de ce plugin — utiliser
    le nom du tag (`sidebar-plus-tree { ... }`) à la place.** Découvert en
    creusant pourquoi le glissoir de redimensionnement était invisible/
    inutilisable pour l'utilisateur. Le SCSS de ce plugin est injecté en CSS
    globale brute (`import './x.scss'` en side-effect, via style-loader —
    nécessaire car `styleUrls` ne marche pas pour un plugin tiers, voir
    piège #3). Le pseudo-sélecteur `:host` n'est interprété QUE par (a) le
    compilateur de templates Angular, qui le transforme en `[_nghost-xxx]`
    lors du traitement des styles déclarés via `@Component({styles: [...]})`
    — ce qui ne s'applique jamais à du CSS importé en side-effect — ou (b)
    un vrai Shadow DOM natif, que cette app n'utilise pas. Résultat : le
    navigateur ignore silencieusement toute règle `:host { ... }` dans ce
    contexte — **aucune erreur, le style est juste un no-op total**. Ça a
    fait planter en cascade tout ce qui dépendait de `position: relative`
    sur l'hôte (le `.grabber` `position: absolute` retombait sur le
    viewport entier comme bloc conteneur, donc positionné n'importe où) en
    plus d'empêcher silencieusement `background-color`/`border-right` de
    s'appliquer. → Toujours cibler le nom du tag custom element réel
    (ex: `sidebar-plus-tree { ... }`, qui correspond au `selector` du
    `@Component`) plutôt que `:host` dans ce projet. Piège sournois car
    aucune erreur de compilation ni console : juste un style qui ne
    s'applique jamais, à vérifier visuellement/via `getComputedStyle` si un
    style d'hôte semble ne pas s'appliquer.

## Reste à faire (la "vision" demandée)

Ordre validé avec l'utilisateur : ~~favoris~~ (fait) → ~~statut live~~ (fait)
→ ~~drag & drop, réorganisation + re-parentage~~ (fait — voir piège #12 pour
l'historique mouvementé) → SFTP docké → workspaces (5e axe, ajouté en cours
de route, voir plus bas).

Demandes utilisateur reçues en cours de route, toutes implémentées : suppression
de groupe via clic droit, re-parentage de groupe par glisser-déposer, édition
de profil via clic droit (redirige vers Paramètres → Profils), glissoir de
redimensionnement pleine hauteur, masquage de "Sans groupe" si vide (voir
section "Fait" pour le détail de chacune). Icônes personnalisées validées le
26/07, pas encore implémentées (voir item 2 ci-dessous).

1. **Accès SFTP direct, façon MobaXterm — DESIGN REVU, remplace le plan
   initial "docké à droite façon FileZilla".** Nouvelle direction donnée par
   l'utilisateur : plutôt qu'un panneau séparé ancré à droite, le SFTP
   utilise **l'espace de la sidebar elle-même** comme emplacement par
   défaut, avec un bouton pour basculer entre la vue Profils/Groupes et la
   vue SFTP (comme l'onglet SFTP de MobaXterm) — le SFTP apparaît
   automatiquement quand une session SFTP est lancée depuis un profil.
   Contraintes qui restent valables du plan initial :
   - PAS une fenêtre flottante.
   - Volet fichiers locaux masqué par défaut, activable (double-panneau façon
     FileZilla en option, pas par défaut).
   - Déclenché depuis un onglet SSH déjà ouvert et connecté (pas de session
     SSH headless créée juste pour le SFTP).
   - Inspiré du plugin SFTP+ déjà installé localement
     (`%APPDATA%\tabby\plugins\node_modules\tabby-sftp-plus`, code source
     lisible directement, licence à vérifier avant réutilisation mais
     l'utilisateur a déjà donné son accord pour s'en inspirer/reprendre du
     code).
   - **Confirmé** : `SFTPPanelComponent`, `SFTPSession` et `SFTPFile` sont
     bien exportés publiquement par `tabby-ssh` (`typings/index.d.ts`). Pas
     besoin de réimplémenter en local comme pour `profile-tree`. Point
     d'attention : `SFTPPanelComponent.session` attend une `SSHSession` déjà
     connectée — cohérent avec la contrainte "depuis un onglet déjà ouvert"
     ci-dessus.
   - À vérifier au moment de l'implémentation : mécanique du bouton de
     bascule Profils/SFTP (état à conserver par onglet SSH actif ? un seul
     état global ?), et comment détecter/écouter le lancement d'une session
     SFTP pour basculer automatiquement la vue.
2. **Icônes personnalisées — VALIDÉ le 26/07, les deux approches retenues
   (pas exclusives) : bibliothèque FontAwesome embarquée + import de SVG
   personnalisé.** Recherche de faisabilité terminée avant validation
   (lecture seule, rien implémenté) :
   - **(a) Bibliothèque FontAwesome embarquée.** `icons.json` (source de
     l'autocomplete natif de Tabby) n'est PAS publié dans le paquet npm
     `tabby-core` (`package.json` → `"files": ["dist","typings"]`, pas de
     `src`) ; il n'existe que dans le monorepo source de Tabby et se
     retrouve **inliné dans le bundle compilé de tabby-settings**
     (`dist/index.js`, ~2000 icônes Font Awesome 6 Free, licence MIT). Pas
     d'import propre à l'exécution possible (dépendrait de détails internes
     non garantis, cassable à chaque mise à jour de Tabby) → **extraire le
     JSON une fois, manuellement, et l'embarquer comme asset statique dans
     ce plugin** (réutilisation légale, licence MIT). Sert de base à un
     sélecteur d'icônes par recherche/grille dans notre sidebar.
   - **(b) Import de SVG personnalisé.** `<profile-icon>` (le tag, déjà
     utilisé dans notre template) accepte nativement tout `icon`/`color`
     commençant par `<` comme du HTML/SVG à injecter (template compilé de
     `tabby-core`, directive `[fastHtmlBind]` sur la branche HTML).
     Redimensionnement CSS déjà géré pour `img`/`svg` enfants — donc
     faisable dès aujourd'hui côté modèle de données.
     ⚠️ **Risque XSS réel, à traiter nous-mêmes, non négociable.**
     `[fastHtmlBind]` (`FastHtmlBindDirective`, tabby-core) fait un
     `element.innerHTML = value` **impératif en TypeScript pur**, hors du
     template Angular — ça contourne totalement la sanitisation d'Angular
     (qui n'agit que sur les bindings `[innerHTML]` dans un template, pas
     sur une affectation DOM directe en code). Aucun `DomSanitizer` utilisé
     côté Tabby. Dans un contexte Electron avec accès Node, une injection
     ici est plus grave qu'un XSS web classique. → **Avant de stocker ou
     d'afficher un SVG importé par l'utilisateur, notre plugin doit le faire
     passer par sa propre sanitisation stricte** (liste blanche de balises
     SVG type `svg`/`path`/`circle`/`g`/`rect`/`polygon`, interdiction de
     `script`, de tout attribut `on*`, des URLs `javascript:` — ne jamais se
     reposer sur `<profile-icon>` natif, qui n'offre aucune protection).
     Bibliothèque de sanitisation à choisir à l'implémentation (ex: DOMPurify
     avec une config SVG restrictive, ou un parseur XML fait main avec liste
     blanche stricte de balises/attributs — pas de solution déjà choisie).
     Autre limite à prendre en compte pour l'UI d'import : `[style.color]`
     (notre `group.color`/`profile.color`) n'est appliqué par Tabby QUE sur
     la branche FontAwesome (`<i>`), jamais sur la branche HTML/SVG — un SVG
     personnalisé doit utiliser `fill="currentColor"`/`stroke="currentColor"`
     et hériter la couleur d'un wrapper `[style.color]` posé par NOUS.
   - Pas encore commencé — priorité et ordre d'implémentation par rapport au
     SFTP/workspaces/multi-sélection à définir avec l'utilisateur.

## Propositions reçues le 26/07, restantes (pas encore décidées)

- ~~Redimensionnement latéral~~ — existait déjà, mais cassé (voir piège
  #14) ; corrigé et rendu pleine hauteur. Fait.
- ~~Masquer "Sans groupe" si vide~~ — fait.
- ~~Icônes personnalisées~~ — validé, voir item 2 de "Reste à faire"
  ci-dessus.

Reste une proposition non décidée :

1. **Sélection multiple (Shift+Clic / Ctrl+Clic) pour déplacement en masse**
   — uniquement pour les **profils**, pas les groupes (précisé par
   l'utilisateur). Permettrait de sélectionner plusieurs profils dans
   l'arbre puis de les glisser-déposer tous ensemble vers un autre groupe en
   un seul geste. Le plus gros morceau des propositions du 26/07 :
   - Nécessite un état de sélection (ex: `Set<string>` d'IDs de profils),
     une logique de sélection par plage (Shift, du dernier élément cliqué
     jusqu'au nouveau) et par ajout/retrait individuel (Ctrl), + un style
     visuel pour les lignes sélectionnées.
   - Le `cdkDrag` d'Angular CDK ne gère pas nativement le "multi-drag" — il
     faudrait, au démarrage du drag sur un élément sélectionné, appliquer le
     déplacement (réordonnancement + changement de groupe, notre
     `onProfileDrop` existant) à **tous** les profils sélectionnés plutôt
     qu'au seul élément physiquement glissé, et adapter l'aperçu de drag
     (`*cdkDragPreview`) pour indiquer "N profils" plutôt qu'un seul nom.
   - Pas de blocage identifié à ce stade, juste une portée non triviale.

## Axe supplémentaire — Workspaces (validé, phase séparée)

Ajouté en cours de discussion (pas dans les 4 axes initiaux), à traiter
**après** le SFTP docké et la suppression de groupe ci-dessus, une fois le
reste stable et testé. Portée validée avec l'utilisateur :

- Plusieurs workspaces nommés (ex: perso / pro / projet X).
- Un workspace ne filtre QUE la **visibilité** des groupes/profils affichés
  dans l'arbre (pas de favoris ni d'ordre indépendants par workspace — un
  seul jeu de favoris/ordre partagé entre tous les workspaces).
- Pas de mécanisme de "masquage" séparé : masquer un profil/groupe = le
  décocher du workspace actif. Les workspaces SONT le mécanisme de masquage.
- Sélecteur de workspace dans la sidebar : dynamique, mix onglets/dropdown
  selon le nombre de workspaces (le détail exact de ce comportement reste à
  définir au moment de l'implémentation — pas encore fixé precisément avec
  l'utilisateur).
- Stocké dans `config.store.sidebarPlus`.

## Notes diverses

- Nom du dossier local sur disque : toujours `tabby-ssh-sidebar` (jamais
  renommé, pour ne pas casser la jonction NTFS en place). Nom du package npm
  + dépôt GitHub : `tabby-better-sidebar`. Rappel : le loader de plugins de
  Tabby se base sur le nom de la **jonction/dossier** dans
  `plugins/node_modules/` (déjà renommée en `tabby-better-sidebar`), pas sur
  le champ `name` du package.json ni sur le nom du dossier source local — donc
  aucun impact fonctionnel, juste une incohérence cosmétique si quelqu'un
  explore l'arborescence locale.
- `LICENSE` utilise toujours le copyright placeholder `"tabby-sidebar-plus
  contributors"` (pas mis à jour avec le nouveau nom) — à corriger avant une
  vraie release.
- Git configuré **localement pour ce dépôt seulement** (pas de
  `--global`) : `user.name`/`user.email` = identité `TooMuhtsh` + email
  noreply GitHub (voir piège #10). Historique : 2 commits sur `master`,
  poussés sur https://github.com/TooMuhtsh/tabby-better-sidebar.

## Points fragiles à revérifier après une mise à jour de Tabby

Ce plugin s'appuie par endroits sur des classes/composants internes de
Tabby non garantis par une API publique stable (marqués `@hidden`, non
exportés, ou du DOM interne sans contrat). Rien de tout ça n'est censé
changer souvent, mais une mise à jour majeure de Tabby (changement de
version d'Angular, refonte d'un composant de settings, etc.) peut casser
l'un de ces points **silencieusement** (aucune erreur de compilation, juste
un comportement qui ne fait plus rien ou fait la mauvaise chose). Après
toute mise à jour de Tabby, tester au moins une fois chaque point ci-dessous
avant de considérer le plugin à jour :

1. **Édition de profil (clic droit → "Éditer...")** — le plus fragile des
   points de cette liste, car il pilote du DOM interne non versionné de
   `tabby-settings` :
   - Chaque ligne (groupe ou profil) est toujours un élément
     `.collapse-item`. Un groupe contient une icône `.fa-folder`/
     `.fa-folder-open` (repliée/dépliée) ; un profil contient un `span`
     avec son nom en texte et **cliquer sur la ligne ouvre toujours
     directement la modale d'édition** (ce n'est pas un bouton dédié — si
     Tabby ajoute un jour un vrai bouton "Éditer" séparé, ce code continuera
     de fonctionner par accident mais vaudrait le coup d'être simplifié).
   - `.modal-content` / `.modal-header h3` / `.modal-footer button` restent
     la structure de la modale d'édition (utilisée pour détecter sa
     fermeture, voir `watchForNativeModalClose()`).
   - Si ça casse : la modale ne s'ouvre plus (rien ne se passe après le
     clic droit → Éditer), ou pire, une ligne différente de celle attendue
     s'ouvre si la structure `.collapse-item`/icônes/`span` a changé de
     sens. Si la détection de fermeture casse (classe `.modal-content`
     renommée), l'onglet Paramètres ouvert par le plugin ne se refermera
     plus tout seul — gênant mais pas destructeur, l'utilisateur peut
     toujours le fermer à la main.
2. **`SettingsTabComponent` et son `@Input() activeTab`** (utilisé pour
   ouvrir directement Paramètres → Profils) — API un peu plus stable que le
   point 1 (c'est un vrai `@Input()` documenté dans les typings, pas du DOM
   brut), mais reste `@hidden` donc non contractuelle. Vérifier que
   `activeTab: 'profiles'` amène toujours sur le bon sous-onglet (l'id du
   provider Profiles, actuellement `'profiles'`, pourrait théoriquement
   changer).
3. **`SFTPPanelComponent`/`SFTPSession`/`SFTPFile`** (prévu pour le panneau
   SFTP docké, pas encore implémenté à ce jour) — vérifier qu'ils restent
   exportés par `tabby-ssh` et que `SFTPPanelComponent.session` attend
   toujours une `SSHSession` déjà connectée.
4. **`profilesService.writeProfileGroup()` / `newProfileGroup()` /
   `deleteProfileGroup()`** — le plugin ne les utilise QUE de façon sûre
   depuis le piège #12 (jamais de réassignation directe de `parentGroupId`
   via `writeProfileGroup`, toujours recréation + migration + suppression
   pour le re-parentage). Si une future version de Tabby change le format
   de stockage des groupes dans `config.yaml` (actuellement : entrées
   plates avec `parentGroupId`, potentiellement aussi nichées en double
   dans un `children:` — voir piège #12), retester le re-parentage sur des
   groupes jetables avant de faire confiance au comportement existant.
5. **`getSyncProfileGroups()` / `buildGroupTree()` sans clone garanti** —
   le fix `structuredClone()` dans `loadTreeItems()` (piège #12) part du
   principe que `getProfileGroups()` peut renvoyer des références vivantes
   vers `config.store.groups`. Si une future version de Tabby clone
   proprement en interne, ce `structuredClone()` devient superflu (mais
   restera inoffensif à garder par précaution — ne pas le retirer sans
   raison).
6. **`profile-tree` toujours non exporté** — le composant natif dont ce
   plugin reprend la logique reste, à ce jour, absent de l'export public de
   `tabby-core`. Vérifier périodiquement (ex: à chaque montée de version
   majeure de `tabby-core` dans `package.json`) s'il n'a pas fini par être
   exporté, ce qui simplifierait grandement la maintenance en permettant de
   réutiliser le composant natif au lieu de la copie locale.
