<div align="center">

# 📁 tabby-better-sidebar

**Sidebar de connexions enrichie pour [Tabby](https://tabby.sh)** — favoris
épinglés, statut de connexion en direct, glisser-déposer, et un explorateur
SFTP contextuel qui vit *dans* la sidebar plutôt que dans un panneau docké à
part.

[English](README.md) · **Français**

[![License: MIT](https://img.shields.io/github/license/TooMuhtsh/tabby-better-sidebar?color=0d9488)](LICENSE)
[![Part of Better Tabby](https://img.shields.io/badge/part%20of-Better%20Tabby-0d9488)](#-better-tabby-la-famille-de-plugins)

</div>

---

Tabby possède une sidebar de profils native, mais elle n'est pas exportée pour
qu'un plugin tiers puisse la réutiliser. Ce plugin la reconstruit et y ajoute
les favoris épinglés, le statut de connexion en direct, le glisser-déposer
entre dossiers, des espaces de travail nommés, la gestion des tunnels SSH, des
snippets, des notes, et un explorateur SFTP complet qui occupe l'espace de la
sidebar et suit l'onglet SSH ayant le focus.

**Chaque bloc est indépendant, et chacun se désactive** depuis l'onglet de
réglages du plugin — si vous n'utilisez jamais les tunnels SSH ni les espaces
de travail, éteignez ces deux-là et la sidebar s'allège d'autant. Rien n'est
supprimé pour autant : vos favoris, espaces de travail et snippets restent
exactement où ils sont, ils cessent simplement d'être affichés.

## 🧩 Better Tabby, la famille de plugins

Ce plugin est l'une des deux moitiés de **Better Tabby**, une petite famille de
plugins indépendants qui partagent un seul onglet de réglages au lieu d'en
disperser plusieurs :

| | Plugin | Apporte |
|---|---|---|
| 📁 | **tabby-better-sidebar** *(ce dépôt)* | Favoris épinglés, statut de connexion en direct, glisser-déposer, espaces de travail, explorateur SFTP contextuel |
| 🔐 | **[tabby-better-vault](https://github.com/TooMuhtsh/tabby-better-vault)** | Déverrouillage automatique du coffre-fort via le trousseau du système |

**Aucun des deux n'a besoin de l'autre.** N'installez que celui-ci et il se
comporte exactement comme si l'autre n'existait pas — son propre onglet de
réglages, rien de partagé. Installez les deux, et ils élisent l'un d'entre eux
pour porter un unique onglet **Better Tabby**, chacun continuant d'y rendre sa
propre page. Aucune dépendance npm entre les deux dépôts, aucun code commun :
juste un petit contrat de chaîne (`BetterPanelContribution:<id>`) que chaque
plugin reconnaît de son côté.

## ✨ L'arbre des profils

- **Favoris épinglés**, pour les profils comme pour les dossiers
- **Statut de connexion en direct** par profil, avec un indicateur de latence
  optionnel — un aller-retour SFTP chronométré sur le canal de la session
  elle-même, et non un ping ICMP, de sorte qu'il mesure le délai réellement
  ressenti à la frappe
- **Section « Sessions actives »** en haut, une ligne par volet plutôt que par
  onglet, avec le temps de connexion, un clic pour donner le focus et un
  raccourci vers la vue SFTP de cette session
- **Profils récents** — les cinq derniers lancés, tous types confondus
  (désactivé par défaut)
- **Glisser-déposer** pour réorganiser — profils et dossiers, y compris déplacer
  un profil d'un dossier à l'autre et changer un dossier de parent
- **Espaces de travail** : masquer profils et dossiers par espace (perso /
  travail / projet), chacun avec ses propres favoris, son propre ordre entre
  frères, sa propre icône et une couleur contextuelle optionnelle ; sélecteur en
  onglets ou en liste déroulante, et export/import JSON en un clic
- **Sélection multiple**, pour agir sur plusieurs profils à la fois
- **Tunnels SSH** : un panneau de ce que Tabby redirige réellement, des badges
  sur les profils qui déclarent des tunnels, et une modale pour en ajouter,
  modifier ou retirer — avec une mémoire des tunnels qu'une session coupée n'a
  pas su remonter
- **Barre de filtrage rapide**, qui cherche dans le nom, la description, l'hôte
  et l'utilisateur — y compris dans ce que l'espace de travail masque
- **Menus contextuels**, regroupés en sous-menus `Gérer` et `Plus` pour rester
  courts : créer et supprimer dossiers et profils, dupliquer un profil,
  renommer, choisir une icône, rattacher snippets et notes, partager un dossier,
  le masquer dans l'espace courant

## 🎨 Icônes

Le sélecteur d'icônes cherche dans trois sources à la fois, entièrement hors
ligne — aucun appel réseau n'est jamais émis :

- **Font Awesome**, la collection qu'utilise Tabby lui-même
- **[Iconify](https://iconify.design)** Material Design Icons et Tabler, pour
  les glyphes génériques
- **[dashboard-icons](https://github.com/homarr-labs/dashboard-icons)** —
  environ 2 400 logos de services auto-hébergés (Proxmox, Pi-hole, Nextcloud et
  compagnie), bien plus parlants qu'un glyphe générique pour nommer un vrai parc
  de machines. Les icônes livrées en plusieurs palettes les proposent sous forme
  de pastilles sur leur tuile, ce qui permet d'échanger un logo sombre contre sa
  variante claire sur un thème sombre.

Les icônes récemment utilisées restent à portée, n'importe laquelle s'épingle en
favori d'un clic droit, et des SVG personnalisés peuvent être importés
(assainis par [DOMPurify](https://github.com/cure53/DOMPurify)).

Les deux grandes collections ne sont chargées qu'**à la première recherche**,
dans un fichier séparé : elles ne coûtent rien au démarrage.

## 📂 SFTP

L'explorateur remplace l'arbre des profils dans l'espace de la sidebar et suit
l'onglet SSH ayant le focus — chaque onglet se souvient d'où il en était, et la
vue peut être **figée** sur une session pour cesser de suivre le focus.

- **Colonnes configurables** (taille, date, permissions en octal et en format
  long, type, extension), tri dossiers d'abord, affichage des fichiers cachés,
  lignes alternées
- **Sélection multiple**, fichiers *et* dossiers, pour supprimer ou déplacer par
  lot
- **Chargement par blocs** des listings volumineux
- **Le double-clic ouvre un fichier dans un éditeur de code**, jamais via
  l'association de fichiers du système — double-cliquer un exécutable l'édite au
  lieu de le lancer. L'enregistrement renvoie le fichier automatiquement, après
  avoir vérifié que la copie distante n'a pas changé entre-temps, et restaure
  ses permissions. Les liens symboliques sont résolus : c'est la cible qui est
  éditée, pas le lien
- **« Ouvrir avec… »** reste disponible, mais seulement depuis le menu contextuel
- **Créer, renommer et supprimer** des entrées — touche `Suppr` comprise, avec
  une confirmation HTML dont vous choisissez le bouton par défaut dans les
  réglages
- **Déplacer une entrée** en la glissant sur un dossier — un `rename` côté
  serveur, rien ne transite
- **Glisser un fichier vers le système** : le téléchargement démarre au dépôt,
  là où vous l'avez déposé
- **Gestionnaire de transferts** en bas de la sidebar — progression, vitesse,
  temps restant estimé et temps écoulé par transfert, contrôle d'arrivée qui
  signale une copie incomplète à destination, confirmation avant annulation,
  visible depuis les deux vues, masqué quand il est vide
- **Rafraîchissement automatique** du listing, optionnel, désactivé par défaut
- **Retour automatique** à la vue Profils dès qu'aucun onglet n'a plus de
  session SFTP active

## 📝 Snippets, notes et partage

- **Snippets** — une commande écrite une fois, rattachée à un profil, à un
  dossier ou à tout, et réutilisable partout où elle est rattachée. Gère les
  variables `{{nom}}` (obligatoire) et `{{nom=valeur}}` (pré-remplie), hérite le
  long de l'arbre des dossiers, et se règle pour écrire dans le terminal, écrire
  puis valider, ou lancer la session au préalable
- **Notes** — un mémo libre par profil ou par dossier, avec un badge dans l'arbre
- **Partager un dossier** par le presse-papiers, en JSON, à deux niveaux : *avec*
  les coordonnées de connexion pour vos propres machines, ou *sans identifiants*
  pour quelqu'un d'autre. Mots de passe, scripts de login, commandes de proxy et
  références au coffre-fort ne voyagent jamais, à aucun des deux niveaux ; ce qui
  a été retiré est annoncé dans la notice, et le JSON est revérifié champ par
  champ au collage

## 🌍 Langues

L'interface suit la langue de Tabby — anglais, plus français, espagnol et
allemand, sur l'ensemble du plugin : arbre des profils, menus contextuels,
sessions actives et tunnels, explorateur SFTP, dialogues, transferts et onglet
de réglages. Toute autre langue retombe sur l'anglais.

## Ailleurs

- <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> insère un saut de ligne dans le terminal au
  lieu de valider
- Un onglet de réglages dédié dans les paramètres de Tabby (partagé sous
  **Better Tabby** quand le plugin vault est également installé)

## 📦 Installation

**Nécessite Tabby 1.0.231 ou plus récent** — développé et testé sur **Tabby
1.0.235**, la version stable actuelle.

Dans Tabby, ouvrir **Paramètres → Plugins**, chercher `better-sidebar`,
l'installer, puis relancer Tabby entièrement.

<details>
<summary>Directement avec npm</summary>

```bash
# Dans le dossier de plugins de Tabby : %APPDATA%\tabby\plugins sur Windows,
# ~/.config/tabby/plugins sur macOS/Linux
npm install tabby-better-sidebar
```

Puis relancer Tabby entièrement.

</details>

## ⚙️ Configuration

Tout se règle dans **Paramètres → Better Sidebar** (ou **Better Tabby → 📁
Sidebar** si `tabby-better-vault` est également installé), réparti entre
*Général*, *Fonctionnalités* et *Snippets*. Sur le disque, les réglages vivent
sous `sidebarPlus` dans le `config.yaml` de Tabby.

<details>
<summary>Tous les réglages, avec leur valeur par défaut</summary>

**Blocs** — chacun s'active indépendamment :

| Réglage | Défaut | Effet |
|---|---|---|
| `enabled` | `true` | Affiche la sidebar. Éteinte, elle disparaît sans rien désinstaller ; cette page de réglages reste accessible |
| `showActiveSessions` | `true` | Connexions SSH ouvertes, en haut de la sidebar |
| `showRecentProfiles` | `false` | Les cinq profils lancés le plus récemment |
| `showTunnels` | `true` | Panneau de redirection de ports et badges sur les profils |
| `showWorkspaces` | `true` | Barre des espaces de travail, au-dessus de la liste |
| `showFilter` | `true` | Champ de recherche et son raccourci |
| `showSftp` | `true` | L'onglet SFTP de la sidebar et son panneau |
| `showTransfers` | `true` | Gestionnaire de transferts en bas de la sidebar |
| `showSnippets` | `true` | L'entrée *Snippets* du clic droit et son onglet |
| `showNotes` | `true` | L'entrée *note* du clic droit et son badge |

Éteindre un bloc coupe aussi son travail de fond — plus de balayage des onglets,
plus de sonde de latence, plus de suivi des transferts pour un panneau que
personne ne regarde.

**Comportement :**

| Réglage | Défaut | Effet |
|---|---|---|
| `hideNativeTransfersMenu` | `true` | Masque le menu des transferts de Tabby, qui montre les mêmes transferts |
| `workspaceSelectorMode` | `tabs` | Barre des espaces de travail en onglets, ou en liste déroulante |
| `pingIntervalSeconds` | `0` | Intervalle de la sonde de latence ; `0` la désactive |
| `sftpAutoRefreshSeconds` | `0` | Relit le dossier courant à intervalle régulier ; `0` désactive |
| `sftpAutoReturnToProfiles` | `true` | Revient à la vue Profils quand plus aucune session SSH n'est ouverte |
| `sftpEditorPath` | *(vide)* | Programme ouvert au double-clic. Vide, Windows décide |
| `sftpDeleteDefaultButton` | `cancel` | Bouton activé par <kbd>Entrée</kbd> dans la confirmation de suppression SFTP |
| `sftpDragOutFolders` | `false` | Autorise le glisser d'un *dossier* vers le système, et pas seulement d'un fichier |
| `sftpColumns` | `size`, `date`, `mode` | Colonnes affichées dans le listing SFTP |
| `sftpFoldersFirst` | `true` | Trie les dossiers avant les fichiers |
| `sftpShowHidden` | `true` | Affiche les fichiers commençant par un point |
| `sftpColumnBorders` | `true` | Séparateurs de colonnes dans le listing |
| `sftpZebra` | `true` | Fond de ligne alterné |

Vos favoris, espaces de travail, snippets, notes, icônes personnalisées et
ordres de tri sont rangés sous la même clé. Ce sont des données, pas des
réglages : rien de ce qui précède ne les supprime.

</details>

## ⚠️ Limites connues

- **L'édition distante ne verrouille rien.** Le plugin vérifie que le fichier
  distant n'a pas changé avant de renvoyer votre modification, et refuse
  d'écraser si c'est le cas — mais deux personnes qui éditent le même fichier en
  même temps, c'est toujours le dernier qui gagne.
- **Glisser vers une cible qui ne comprend pas une offre de fichier différée**
  (Terminal Windows, MobaXterm) ne produit rien du tout, en silence. La source
  ne peut pas le détecter.
- **Un profil partagé par le presse-papiers conserve son hôte et son port.**
  C'est délibéré — c'est ce qui rend le dossier utile — mais cela signifie que le
  JSON décrit votre réseau. Utilisez *Copier sans les identifiants* quand cela
  compte.
- **Les profils shell locaux ne sont jamais partagés** : leurs options sont une
  commande à exécuter, précisément ce qui ne doit pas arriver par un
  presse-papiers.

## 🛠️ Développement

```bash
git clone https://github.com/TooMuhtsh/tabby-better-sidebar
cd tabby-better-sidebar
npm install --ignore-scripts   # évite des postinstall qui compilent du natif inutile ici
npm run watch
```

Puis, Tabby fermé, lier le dossier dans le répertoire de plugins de Tabby. Ne
pas utiliser la variable d'environnement `TABBY_PLUGINS` — elle est cassée sur
Windows :

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<chemin-de-ce-dossier>"
```

Relancer Tabby entièrement après chaque reconstruction — recharger la fenêtre ne
suffit pas, l'état du chargeur de plugins étant global au processus.

## Voir aussi

[**tabby-better-vault**](https://github.com/TooMuhtsh/tabby-better-vault) — le
plugin frère, voir [Better Tabby](#-better-tabby-la-famille-de-plugins)
ci-dessus.

[**Documentation de gouvernance IA**](https://toomuhtsh.github.io/tabby-better-sidebar/.AIRules/README.html) —
ce plugin est développé avec un assistant IA sous une charte de gouvernance
écrite, et le dossier de travail complet est public : invariants et pièges
numérotés, journal de développement, roadmap et registre de tout ce qui a été
livré, consultables comme un petit site statique.

## Crédits

- [Tabby](https://github.com/Eugeny/tabby) d'Eugeny — le terminal que ce plugin
  étend ; sa sidebar de profils native est le point de départ de celle-ci
  (MIT, voir [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md))
- [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) — la
  collection de logos de services (Apache-2.0)
- [Iconify](https://iconify.design) Material Design Icons et Tabler, ainsi que
  [DOMPurify](https://github.com/cure53/DOMPurify)

## Licence

MIT — voir [LICENSE](LICENSE).
