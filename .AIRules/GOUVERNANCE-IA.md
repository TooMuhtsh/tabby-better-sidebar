# Gouvernance IA — charte générique pour projets de développement

Ce fichier décrit un ensemble de règles de gouvernance IA réutilisables **telles quelles sur
n'importe quel projet ou workspace de développement**, indépendamment du langage, du framework
ou de la nature du logiciel (application, bibliothèque, plugin...). Il ne présuppose l'existence
d'aucun projet en particulier. C'est un modèle à appliquer dans quatre situations :

- un **nouveau projet**, dès sa création ;
- un **projet existant sans gouvernance formalisée** ;
- un projet dont la gouvernance **existe sous une autre forme** (`CLAUDE.md` devenu fourre-tout,
  notes Markdown, wiki, tickets) et qu'il s'agit de transposer — **Règle 7, Cas A** ;
- un projet **déjà au format `.AIRules/` mais dont le contenu a dérivé**, ou qui est resté conforme
  à une révision antérieure de cette charte — **Règle 7, Cas B**.

### Ce fichier reste la référence, à tout moment

La charte ne se lit pas seulement au moment d'un SETUP ou d'une mise en conformité : **elle est la
référence pendant toute session, sur tout projet du workspace**, y compris quand la session démarre
directement dans un projet. En cas de contradiction entre elle et un `CLAUDE.md`, une page
`.AIRules/` ou une habitude prise en cours de route, c'est elle qui tranche — et la contradiction
elle-même est à signaler plutôt qu'à contourner (règle de détection de dérive, Règle 4).

Elle est aussi **susceptible d'évoluer à tout moment** : une révision peut ajouter, réécrire ou
retirer une règle. Deux conséquences pratiques, détaillées Règle 7 § « Suivre les révisions de la
charte » :

- la date du pied de page est le seul numéro de version — celle de l'original comme celle des copies
  `.AIRules/` et des mentions « Conforme à la charte de gouvernance du {{date}} » ;
- une révision **ne s'applique jamais d'office** à un projet déjà conforme à une révision
  antérieure : l'écart se signale, la remise à niveau se propose.

## Règle 1 — Un dossier `.AIRules/` par projet, versionné avec le code

Chaque dépôt de projet contient à sa racine un dossier `.AIRules/` qui porte sa gouvernance IA.

- **Versionné dans le dépôt Git du projet lui-même** (pas à part, pas dans un dépôt séparé) : un
  `git clone` sur une autre machine récupère donc l'intégralité de l'historique, des pièges et
  de la roadmap en même temps que le code.
- Si plusieurs projets cohabitent dans un même workspace, l'un peut référencer le `.AIRules/`
  d'un autre par lien relatif (ex. `../autre-projet/.AIRules/README.html`) tant que les deux
  dossiers restent côte à côte — utile quand un chantier est extrait vers un nouveau projet
  séparé.
- Contenu attendu, quatre fichiers (voir Règle 2) + une feuille de style partagée + une copie de
  la présente charte :

  ```
  .AIRules/
    README.html         (index + protocole)
    AI-CONTEXT.html     (invariants, pièges numérotés, points fragiles)
    AI-HISTORY.html     (journal chronologique par chantier)
    ROADMAP.html        (statut / priorité / design des chantiers restants)
    style.css           (partagé par toutes les pages, y compris annexes et archive)
    GOUVERNANCE-IA.md   (copie conforme de la charte appliquée — voir ci-dessous)
    annexes/            (optionnel — pièces jointes volumineuses, voir ci-dessous)
    archive/            (optionnel — délestage des pages principales, voir ci-dessous)
    {{page}}/           (optionnel — pages de détail d'une page éclatée, voir ci-dessous)
  ```

#### La charte voyage avec le projet

`GOUVERNANCE-IA.md` est **copié à l'identique dans le `.AIRules/` de chaque projet**. L'original
canonique vit dans un dépôt public dédié, indépendant de tout workspace ou machine — local comme
distant (poste perso, projet pro, VPS...) :

```
https://github.com/TooMuhtsh/Claude-Governance.git
```

Motif de la copie locale malgré tout : un `git clone` d'un projet doit ramener les règles qui le
régissent en même temps que le code, pas seulement les documents qu'elles produisent — sans
dépendre d'un accès réseau à ce dépôt tiers, ni d'un submodule (qui romprait cette garantie : un
clone sans `--recurse-submodules` laisserait `.AIRules/` incomplet). Un workspace peut, par
commodité, garder une copie de travail à sa racine hors dépôt Git (comme c'est le cas pour
`Développement/`) ; cette copie n'est pas une seconde source de vérité, seulement un miroir local
du dépôt canonique — voir son `README.md` pour le protocole de synchronisation (comparaison des
dates de pied de page, propagation verbatim, vérifiée par `diff`).

#### Vérifier la conformité à la charte, périodiquement et sans y penser

Au-delà de la vérification en début de session (Règle 7 § « Suivre les révisions de la charte »),
une tâche planifiée (cron) peut interroger périodiquement le dépôt canonique et comparer sa date de
pied de page à celle de chaque projet suivi. Cette tâche se génère **localement, par le Claude Code
de l'environnement concerné** — pas une tâche centrale unique qui devrait connaître à l'avance tous
les environnements et tous les projets : chacun découvre et couvre les projets réellement présents
chez lui (poste perso, projet pro, VPS...). En cas d'écart, elle peut déclencher une session Claude
dont le mandat reste strictement borné :

- récupérer la révision à jour du dépôt canonique ;
- créer une **branche dédiée** dans chaque projet concerné — jamais une écriture directe sur la
  branche principale, conformément à la règle « `.AIRules/` reflète toujours l'état de la branche
  principale » ci-dessous ;
- y propager la charte verbatim et, si pertinent, une proposition de remise à niveau du projet
  (Règle 7, Cas B) ;
- s'arrêter là. La fusion vers la branche principale reste un acte de **validation humaine
  explicite** (Règle 2) : la tâche planifiée ne merge jamais d'elle-même, et n'écrit jamais
  directement dans les quatre pages `.AIRules/` (leur écriture attend toujours un feu vert, y
  compris quand l'écart vient d'une détection automatisée plutôt que d'une session ordinaire).

Cette automatisation est un confort, pas une obligation : un projet peut tout aussi bien rester sur
la détection manuelle en début de session.

Sur un poste avec interface graphique, le sondage doit rester invisible : une tâche qui fait
apparaître une fenêtre de terminal en plein travail va à l'encontre du « sans y penser » évoqué
plus haut. Attention en particulier à ne pas confondre la visibilité de la *tâche* dans l'outil de
planification (souvent une simple option « masquée » qui ne concerne que sa liste de gestion) et
la visibilité de la *fenêtre du processus* qu'elle lance : quand le script est lui-même un
exécutable à console (interpréteur Node, Python...), l'invoquer directement l'ouvre quand même —
passer par un lanceur qui masque explicitement la fenêtre du processus exécuté.

- **Copie conforme, jamais adaptée au projet.** Aucune personnalisation, aucun en-tête ajouté : les
  copies doivent rester comparables à l'original par un simple `diff`. Ce qui est spécifique à un
  projet vit dans ses quatre pages, jamais dans sa copie de la charte.
- **À chaque révision de la charte, propager les copies dans la foulée**, dans le même mouvement que
  la mise à jour de la date de pied de page — et les pousser, comme toute modification de
  `.AIRules/` (section suivante).
- La date de pied de page reste le seul numéro de version : une copie dont elle est antérieure à
  celle de l'original est une copie périmée, ce qui se détecte sans lire le contenu.

- Le projet peut aussi porter un dossier `.tempfiles/` (**ignoré par Git**, contrairement à
  `.AIRules/`) pour les notes de brief, brouillons et fichiers d'échange ponctuels. Ces fichiers
  sont **jetables par construction** : une fois **entièrement** exploités ailleurs (code,
  `.AIRules/`, mémoire persistante), ils se suppriment directement, sans demander confirmation et
  sans les laisser traîner.
  - **« Exploité » signifie que plus rien d'actionnable n'y reste.** Une extraction partielle —
    quelques lignes reprises d'un brouillon qui en contient plusieurs — ne l'épuise pas. Un fichier
    de notes en vrac dont une seule idée a servi n'est pas jetable tant que le reste n'a pas été
    traité ou explicitement abandonné par l'utilisateur.
  - Dans le doute sur l'épuisement réel d'un fichier — pas seulement sur son type — redemander
    plutôt que supprimer. Cette réserve s'ajoute à, sans la remplacer, l'exclusion de tout fichier
    de code ou de configuration : ces derniers ne sont jamais couverts par cette règle, quel que
    soit leur état.

#### Fichiers annexes — dossier `annexes/`

Les quatre pages sont volontairement peu nombreuses ; certains contenus n'y tiennent pourtant pas
sans les rendre illisibles (relevé de mesures, tableau de correspondance long, capture d'une
configuration de référence, note de conception détaillée sur un seul chantier). Ces contenus vont
dans un sous-dossier `annexes/`, **versionné comme le reste de `.AIRules/`** — à ne pas confondre
avec `.tempfiles/`, qui est ignoré par Git et jetable par construction.

- **Optionnel** : `annexes/` ne se crée qu'au moment où un premier fichier annexe existe. Pas de
  dossier vide « au cas où ».
- **Aucune annexe orpheline** : tout fichier d'`annexes/` est atteignable depuis l'une des quatre
  pages par une **chaîne de liens continue**, à l'endroit où sa lecture devient pertinente, chaque
  page intermédiaire portant le lien de retour vers celle qui la cite. Le nombre de sauts est
  indifférent ; ce qui est interdit, c'est la **rupture** — une page qu'on ne peut atteindre qu'en
  connaissant son chemin. Une annexe qu'aucune page ne cite n'est pas une annexe, c'est un fichier
  oublié.
- **Une annexe complète, elle ne remplace pas.** Le fait, l'invariant ou la décision reste énoncé
  dans la page principale ; l'annexe ne porte que le détail volumineux qui l'étaye. Déporter la
  conclusion elle-même en annexe recrée exactement le problème que ce format évite.
- Un format non-HTML est acceptable quand il est plus adapté (`.md`, `.json`, `.csv`, capture
  d'écran) : une annexe est une pièce jointe, pas une cinquième page de gouvernance.
- **Note d'annexe.** Quand le format ou le poids d'une pièce l'empêche de porter son propre lien de
  retour (binaire, tableur, image, jeu de données volumineux), ou quand la pièce vit délibérément
  **hors du dépôt** (volume qui alourdirait chaque clone et chaque sauvegarde, ressource sur une
  autre machine), l'annexe versionnée est une **note Markdown** qui tient ce rôle à sa place. Elle
  porte le lien de retour vers la page qui la cite et dit : où la pièce se trouve, pourquoi elle est
  là plutôt que dans le dépôt, comment la régénérer, et **ce qu'on en a appris**. C'est ce dernier
  point qui la justifie : la pièce peut disparaître, la connaissance qu'elle a produite doit lui
  survivre. La note *est* l'annexe ; la pièce n'en est que le support.

#### Archive — dossier `archive/`

Un document principal qui a beaucoup servi devient long, et sa longueur finit par nuire à ce pour
quoi il existe : `AI-HISTORY.html` accumule les chantiers clos depuis des mois, `ROADMAP.html`
traîne des sections « Hors périmètre » que plus personne ne relit. Un sous-dossier `archive/` permet
de **délester une page principale sans rien perdre**.

- **Le contenu est intouchable, la navigation ne l'est pas.** Aucun texte archivé ne se réécrit, ne
  s'élague ni ne se résume ; mais un **lien de navigation** dont la cible a bougé se répare — garder
  une archive accessible n'est pas réécrire l'histoire. Trois cas, dans cet ordre : la cible existe
  ailleurs → le lien pointe sa nouvelle position, en chemin relatif ; la cible a disparu → le lien
  devient du texte brut disant ce qu'il désignait et qu'il n'existe plus ; **jamais de suppression
  silencieuse** du renvoi. Un commit qui répare des liens d'archive ne touche qu'aux liens, et le
  dit dans son message.
- **Déplacement intégral, jamais réécriture.** Un chantier s'archive en entier — son `<h2>`, son
  paragraphe de contexte, son tableau complet — recopié tel quel. Le contenu archivé reste, comme sur
  la page d'origine, en **ajout seul** : il ne se corrige pas, ne se résume pas, ne se condense pas.
  Un archivage n'est pas l'occasion de réécrire l'histoire.
- **Une ligne de renvoi reste en place** dans la page principale, à la position chronologique du
  contenu déplacé : titre du chantier, sa période, et le lien vers la page d'archive. Sans elle, le
  lecteur de la page principale ne peut pas savoir que quelque chose a existé — c'est précisément ce
  qui distingue un archivage d'une suppression.
- **Un archivage attend le feu vert explicite de l'utilisateur**, comme toute écriture dans
  `AI-HISTORY.html`/`ROADMAP.html` (Règle 2) : sortir un chantier du journal *est* une écriture dans
  le journal. La proposition dit quels chantiers partiraient et ce que la page principale garderait.
- **`AI-CONTEXT.html` ne s'archive pas.** Ses ancres `#piege-N` sont référencées depuis `CLAUDE.md`
  et depuis `ROADMAP.html` : déplacer un piège dans un sous-dossier casse silencieusement chacune de
  ces références, sans message d'erreur ni moyen de s'en apercevoir. S'y ajoute qu'un piège résolu se
  conserve en place parce qu'il documente pourquoi le code est écrit ainsi (Règle 7, Cas B). Une
  catégorie entière peut à la rigueur partir si le composant qu'elle décrit a disparu du projet — à
  condition de vérifier d'abord qu'aucun `#piege-N` qu'elle contient n'est cité ailleurs.
- Les numéros `#N` d'un contenu archivé **restent consommés** : un numéro libéré par un archivage ne
  se réattribue jamais.
- Une archive ne s'élague pas et ne se supprime pas. Un contenu dont on accepte la perte n'avait pas
  à être archivé — il avait à être supprimé, par une décision explicite, pas comme effet de bord d'un
  rangement.

#### Éclatement d'une page principale — sous-dossier dédié

Quand un dépôt porte plusieurs applications ou composants livrables distincts, une page principale —
en pratique `ROADMAP.html`, parfois `AI-HISTORY.html` — cesse d'être lisible en un seul fichier. Elle
peut alors être **éclatée** en pages de détail, une par périmètre, dans un sous-dossier portant son
nom (`roadmap/ROADMAP_{{app}}.html`).

- **Les quatre pages restent quatre.** La page éclatée demeure à la racine de `.AIRules/`, garde sa
  place dans la navbar, et devient un **index de renvois** vers ses pages de détail. Une page de
  détail n'est pas une cinquième page de gouvernance : elle suit le squelette des pages de
  sous-dossier (Règle 2), sans navbar, avec sa ligne `<p class="muted">` de retour vers l'index.
- **Périmètres disjoints.** Un chantier appartient à une page de détail et une seule. Un chantier
  transverse à plusieurs périmètres reste sur l'index.
- **Un index de renvois ne porte aucun statut.** Quand le détail d'un chantier vit dans une autre
  page, l'index n'en donne que le nom et le lien — jamais le statut, la priorité ni l'avancement,
  portés **exclusivement** par la page de détail. Deux pages qui décrivent le même fait divergent, et
  l'index est celle qu'on oublie. Le tableau « Vue d'ensemble » décrit en Règle 2 garde ses colonnes
  `Statut`/`Priorité` **tant que le détail est sur la même page** ; il les perd à l'éclatement. Les y
  maintenir suppose qu'elles soient **générées** depuis les pages de détail, jamais saisies à la main.
- **Dernier recours, pas réflexe d'organisation.** L'éclatement se déclenche quand la page dépasse ce
  qu'on relit d'un bout à l'autre, et se décide avec l'utilisateur comme tout changement structurant
  (Règle 6).

### Trois questions à poser au SETUP, avant de créer quoi que ce soit

La Règle 1 suppose un dépôt Git : `.AIRules/` y est versionné, et la section suivante impose de
pousser à chaque mise à jour. Sur un **nouveau projet**, ces trois points se demandent donc à
l'utilisateur **avant** de créer le dossier, jamais en les devinant ni en les repoussant au premier
push :

1. **Nom du dépôt distant.** Il ne se déduit pas du nom du dossier local : les deux divergent
   fréquemment (dossier historique jamais renommé, nom de paquet différent du nom de projet). Poser
   la question évite qu'un `.AIRules/README.html` pointe vers une URL inventée.
2. **Dépôt privé ou public.** À trancher avant le premier commit, pas après : cette réponse
   conditionne ce qui peut légitimement être écrit dans le dépôt (chemins de machine, noms d'hôtes,
   captures de configuration) et tranche du même coup la question des **métadonnées d'attribution IA
   dans les messages de commit** (Règle 3) — dont la décision s'écrit dans le `CLAUDE.md` du projet
   à ce moment-là. Rendre public plus tard un dépôt écrit comme privé oblige à réécrire
   l'historique ; l'inverse ne coûte rien.
3. **Quel compte / quelle authentification GitHub CLI (`gh`) pour ce dépôt ?** Toute la
   synchronisation ultérieure (création du dépôt, push, PR) passe par `gh`, qui détient son propre
   jeton — et plusieurs comptes peuvent cohabiter sur une machine. Poser la question au SETUP, pas
   au premier push, quand un échec d'authentification tombe au milieu d'autre chose. Mise en œuvre :
   vérifier l'état par `gh auth status` ; si une connexion est nécessaire, **c'est l'utilisateur qui
   exécute `gh auth login`** — session interactive avec saisie de secret, à lancer dans Claude Code
   en préfixant la commande par `!` pour que sa sortie revienne dans la conversation. Ne jamais
   demander un jeton en clair ni l'écrire dans un fichier du dépôt.

### `.AIRules/` reflète toujours l'état de la branche principale

**Sur `main`, `.AIRules/` décrit ce qui est sur `main` — jamais un état futur, jamais un travail en
cours.** C'est ce qui permet de lui faire confiance sans vérifier : quiconque lit la roadmap ou
l'historique depuis la branche principale y voit l'état réel du projet publié, pas une intention.

- **Committer et pousser à chaque mise à jour**, dans la foulée du travail qu'elle décrit. Une
  gouvernance à jour qui dort en local n'a aucune valeur : elle n'est ni sauvegardée, ni
  récupérable depuis une autre machine, ni exploitable par un outil externe qui lit le dépôt.
  Éviter d'accumuler plusieurs chantiers documentés avant de pousser.
- **Un état transitoire vit sur une branche, `.AIRules/` compris.** Tant qu'un chantier n'est pas
  abouti, sa documentation l'accompagne sur sa branche et arrive sur `main` avec lui, dans le même
  merge. Ne pas décrire sur `main` un code qui n'y est pas encore.
- Corollaire pratique : une entrée de journal se rédige au moment du commit qu'elle décrit — mais
  elle ne peut pas porter le hash de son propre commit, puisqu'elle est écrite avant que celui-ci
  existe. La colonne `Hash` a donc trois valeurs, et trois seulement :
  - le **hash réel**, quand l'entrée décrit un commit déjà fait ;
  - **`(commit en cours)`**, marqueur d'attente d'une entrée qui part dans le commit qu'elle décrit.
    Le remplacer par le hash réel dès le commit suivant est la **seule modification autorisée d'une
    entrée existante** : elle ne réécrit rien, elle complète. Un `(commit en cours)` qui survit à
    plusieurs commits est une anomalie, repérable par un simple `grep` ;
  - **`n/a` suivi de la raison entre parenthèses**, réservé au travail qui **restera** hors de Git :
    opération système, action sur une autre machine, ressource hors dépôt.

  Ne jamais employer une formule comme « non commité » : elle recouvre les deux derniers cas à la
  fois, si bien qu'un oubli devient indiscernable d'une valeur légitime et n'est plus rattrapable que
  par un rapprochement manuel, commit par commit. Si l'ordre s'inverse malgré tout et qu'une entrée
  passée se révèle fausse, ne pas la réécrire : ajouter une table de correspondance en tête du
  chantier.

## Règle 2 — Pages de gouvernance en HTML pur (HTML/CSS uniquement, pas de JS), navbar et rendu partagés

Les quatre pages sont des fichiers HTML statiques ouverts directement dans un navigateur
(pas de serveur, pas de build). Elles ne prennent pas leur contenu depuis Markdown ni depuis un
générateur — HTML/CSS écrits à la main, aucun JavaScript.

### Squelette commun à chaque page

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{{nom du projet}} — {{titre de la page}}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<nav class="tabbar">
<a href="README.html">Accueil</a>
<a href="AI-CONTEXT.html">Contexte</a>
<a href="AI-HISTORY.html">Historique</a>
<a href="ROADMAP.html">Roadmap</a>
</nav>

<h1>{{titre}}</h1>
<p class="muted">Dernière revue : {{date}}</p>

<!-- contenu -->

<footer>{{nom du projet}} · {{note de bas de page}}</footer>
</body>
</html>
```

- La navbar (`nav.tabbar`) est **identique sur les 4 pages**, seul le lien de la page courante
  porte la classe `class="current"`.
- `style.css` est partagé par les 4 pages d'un même projet (un seul fichier, pas dupliqué par
  page). Il définit :
  - des variables CSS pour le thème clair/sombre via `@media (prefers-color-scheme: dark)`
    (pas de bascule JS — le thème suit celui de l'OS/navigateur) ;
  - des styles de callout : `.callout.note`, `.callout.warning`, `.callout.important` (bordure
    et fond colorés, `.callout-title` en gras) ;
  - des pastilles de statut `.pill.done` / `.pill.adopted` / `.pill.progress` / `.pill.planned` /
    `.pill.out` / `.pill.warn` pour les tableaux de roadmap et les points à revérifier ;
  - police système, largeur de lecture max ~900px centrée, tableaux avec lignes zébrées.

#### Discipline d'édition, à mesure que les pages grossissent

Une page comme `AI-HISTORY.html` ou `ROADMAP.html` s'allonge avec le temps, et le risque d'y casser
une balise (`</td>`, `</tr>`, `</div>` oublié) augmente avec sa taille — un copier-coller ou une
réécriture large suffit à faire sauter tout le rendu, souvent sans qu'aucune erreur ne le signale
avant l'ouverture dans un navigateur.

- **Modification ciblée, jamais réécriture complète d'une page existante** pour un ajout localisé
  (une ligne de tableau, une entrée de chantier) — patcher le bloc concerné, pas régénérer le
  fichier entier.
- **Valider le bon parenthésage des balises après toute modification d'une page qui dépasse une
  taille triviale**, avant de considérer la modification terminée. L'outil précis (linter HTML,
  validateur XML strict, ou autre) n'est pas fixé ici : il se choisit par projet selon ce qui y est
  disponible, et se documente comme une commande de plus dans le `CLAUDE.md` du projet (Règle 3),
  pas dans la charte elle-même.

#### Pages placées dans un sous-dossier (`annexes/`, `archive/`)

**La navbar `nav.tabbar` est réservée aux quatre pages principales.** Elle sert à identifier la
gouvernance elle-même : une page qui la porte est l'une des quatre, point. Une page annexe ou
d'archive n'en a donc pas — elle se rattache à la gouvernance par des hyperliens, pas par une barre
de navigation.

Le squelette d'une telle page est celui ci-dessus **sans le bloc `<nav class="tabbar">`**, avec :

- une ligne `<p class="muted">` juste sous le `<h1>`, qui dit de quelle page elle dépend et porte le
  lien de retour vers l'endroit exact qui la cite — ex. « Annexe de
  <a href="../ROADMAP.html#slug">Roadmap → {{chantier}}</a> ». C'est le seul chemin de retour, donc
  il est obligatoire : sans lui, une page atteinte par un signet ou une recherche est un cul-de-sac ;
- la feuille de style partagée atteinte par le même mécanisme (`../style.css`), jamais recopiée dans
  le sous-dossier ;
- un `<footer>` identique à celui des pages principales.

#### Tous les liens internes sont relatifs, jamais en dur

Cette règle vaut pour les quatre pages comme pour les annexes et les archives : un lien vers un autre
fichier de gouvernance, vers `style.css`, vers un fichier du dépôt ou vers le `.AIRules/` d'un projet
voisin s'écrit **en chemin relatif**, avec autant de `../` que la profondeur réelle du fichier
l'exige (`../` depuis `annexes/`, `../../` depuis un sous-dossier d'`annexes/`, et ainsi de suite).

Jamais de chemin absolu, jamais de chemin de machine (`file:///C:/Users/...`, `/home/...`), jamais de
`/` initial. Motif : `.AIRules/` est versionné et doit s'ouvrir tel quel après un `git clone` sur
n'importe quelle machine, sous n'importe quel chemin — un lien en dur y casse silencieusement.
Corollaire : déplacer une page dans un sous-dossier impose de recalculer ses liens ; ce n'est pas un
copier-coller.

### Contenu détaillé et agencement, page par page

Chaque page suit un plan fixe, dans cet ordre. Ne pas réordonner les sections d'une page à
l'autre : la valeur du format vient de sa prévisibilité — on sait toujours où chercher une
information sans relire toute la page.

#### `README.html` — index + protocole

Ordre des sections après le `<h1>{{Nom du projet}} — Gouvernance IA</h1>` :

1. **Paragraphe de description** du projet (2-4 phrases : ce que c'est, la fonctionnalité ou le
   problème central qu'il adresse).
2. **Liste** (`<ul>`) : emplacement du dépôt de code (chemin local), lien vers le dépôt distant
   s'il existe (GitHub/GitLab...), rappel que ce dossier `.AIRules/` vit dans le même dépôt.
3. **Note `.muted`** rappelant explicitement que ce dossier est versionné avec le code — donc
   qu'un `git clone` sur une autre machine récupère tout l'historique et la roadmap avec.
4. **`<h2>Structure</h2>`** : un tableau à deux colonnes (`Fichier` / `Contenu`) qui liste les
   trois autres fichiers avec une description d'une phrase chacun — sert de point d'entrée
   cliquable vers les trois autres pages.
5. **`<h2>Protocole</h2>`**, avec trois sous-sections :
   - **`<h3>En début de session sur ce projet</h3>`** : liste ordonnée (`<ol>`) des étapes à
     suivre avant de commencer à coder — typiquement : lire `AI-CONTEXT.html` (invariants et
     pièges déjà résolus), lire le haut d'`AI-HISTORY.html` (où en est le dernier chantier actif),
     vérifier l'état réel du projet avant de faire confiance à la doc (build à jour, dernier
     commit, état d'un service externe si pertinent), et comparer la date de conformité du pied de
     page à la dernière révision de la charte de gouvernance — si elle est antérieure, signaler
     l'écart et proposer une remise à niveau (Règle 7, Cas B) plutôt que de l'appliquer d'office.
   - Deux **callouts `.important`** juste après cette liste, toujours les deux mêmes règles
     (texte adaptable au projet, principe identique — voir Règle 4 pour le détail) :
     « Règle de détection de dérive » et « Validation utilisateur avant toute écriture dans
     `AI-HISTORY.html`/`ROADMAP.html` » — cette seconde règle ne se limite pas au passage en
     « fait » : elle couvre aussi les lignes d'état intermédiaires et les descriptions de design.
   - **`<h3>Quand mettre à jour</h3>`** : liste à puces donnant la cadence de mise à jour de
     chacun des trois autres fichiers. **Deux cadences opposées, à ne pas confondre :**
     - `AI-CONTEXT.html` **s'écrit au fil de l'eau, sans rien demander** : dès qu'un piège
       technique notable est rencontré ou qu'un nouvel invariant apparaît, il est consigné
       immédiatement, avant même que le chantier en cours soit terminé. C'est le seul document
       alimenté proactivement. Quand une décision de design change, remplacer la section périmée
       plutôt que l'empiler.
     - `AI-HISTORY.html` et `ROADMAP.html` **attendent le feu vert explicite de l'utilisateur** :
       aucun changement de statut, aucune décision de design actée, aucune description de
       correctif n'y est écrite avant qu'il ait confirmé — y compris une mention intermédiaire du
       type « implémenté, en attente de test ». Un build qui passe ou un déploiement réussi ne
       déclenchent rien ici. En cas de doute sur la nature d'une modification de doc (piège ou
       statut), demander.
     - **Exception — session qui s'éternise** : quand une session s'allonge au point que le
       contexte risque d'être perdu (compactage, effacement, interruption), ne pas attendre
       passivement le feu vert. Proposer un point de gouvernance — résumé de ce qui a été fait et
       de ce qui reste — et n'écrire dans `AI-HISTORY.html`/`ROADMAP.html` que ce que
       l'utilisateur valide à ce moment-là. L'objectif est de ne pas perdre le travail en cours,
       pas de contourner la validation.

     Terminer la sous-section par un rappel explicite que les entrées déjà écrites
     d'`AI-HISTORY.html` ne se modifient jamais.
   - Si le projet a une discipline de test spécifique à respecter (voir Règle 4), une dernière
     **`<h3>Discipline de test</h3>`** qui la rappelle en une ou deux phrases.
6. **`<footer>`** : nom du projet + date de la dernière restructuration de la gouvernance
   elle-même (pas la date du dernier chantier — celle-là vit dans `AI-HISTORY.html`), suivie de la
   mention **« Conforme à la charte de gouvernance du {{date}} »** qui reprend la date de révision
   de la charte appliquée. C'est ce marqueur qui permet, plus tard, de détecter qu'un projet est
   resté sur une version antérieure des conventions (voir Règle 7, Cas B).

#### `AI-CONTEXT.html` — invariants et pièges, groupés par catégorie

Ordre des sections après le `<h1>Contexte &amp; invariants</h1>` et la ligne
`<p class="muted">Dernière revue : {{date}}</p>` :

1. **Paragraphe d'intro** rappelant l'objectif du fichier : éviter de retomber deux fois dans le
   même piège, donc organisation **par catégorie thématique** (pas chronologique — ça, c'est le
   rôle d'`AI-HISTORY.html`). Préciser explicitement que la numérotation `#N` des pièges est
   **stable et ne se renumérote jamais**, même si l'ordre d'affichage change — elle est
   référencée ailleurs (`CLAUDE.md`, `ROADMAP.html`). Préciser aussi que les commandes de
   build/dev ne sont pas dupliquées ici (elles restent dans `CLAUDE.md`).
2. **Callout `.note`** "Légende" expliquant la convention de pastille utilisée pour les pièges
   qui dépendent d'un comportement non contractuel d'une dépendance externe (voir tableau des
   pastilles ci-dessous) — cette pastille signale qu'il faut rejouer ce point après une mise à
   jour de cette dépendance.
3. **`<h2>Sommaire</h2>`** : une liste à puces d'ancres vers chaque catégorie (`<h2 id="cat-...">`
   plus bas), chaque entrée listant aussi les numéros `#N` des pièges qu'elle contient — permet de
   sauter directement à la bonne section sans tout parcourir. Immédiatement sous le sommaire, une
   ligne `.muted` donne le **prochain numéro de piège libre** (voir « Compteur de numérotation »
   dans les conventions transverses) : sans elle, l'ajout d'un piège produit tôt ou tard une
   collision avec un numéro déjà attribué plus haut dans le fichier.
4. **Une `<h2 id="cat-...">` par catégorie**, dans un ordre stable. Catégories typiques à adapter
   au projet (toutes ne s'appliquent pas partout) : identité du projet (nom, emplacements,
   identité Git si spécifique) ; environnement & build ; architecture/composants du framework
   utilisé ; comment vérifier qu'une classe/API/dépendance externe est réellement utilisable avant
   de s'y fier ; intégrité et persistance des données ; VCS/Git ; debug et workflow de dev ;
   publication et distribution.
5. **À l'intérieur d'une catégorie**, deux formats possibles :
   - un fait stable simple : une puce de liste, sans numéro (ex. une convention de nommage, un
     choix de version verrouillée) ;
   - un **piège documenté** : `<h3 id="piege-N">#N — {{titre court}}</h3>` suivi d'un paragraphe
     qui décrit **le symptôme, la cause, et la solution retenue** (dans cet ordre — un futur
     lecteur doit pouvoir reconnaître le symptôme avant de lire la solution), avec un bloc
     `<pre><code>` si une commande/config est nécessaire pour reproduire le contournement, et un
     **callout `.warning`** séparé si le piège a un effet de bord opérationnel à connaître
     au-delà de la cause immédiate (ex. "telle action UI supprime tel fichier de config sans le
     dire").

#### `AI-HISTORY.html` — journal chronologique par chantier

Ordre après le `<h1>Journal de bord</h1>` :

1. **Note `.muted`** rappelant l'ordre de tri : chantiers classés du plus récent au plus ancien ;
   à l'intérieur d'un chantier, entrées les plus récentes en tête.
2. **Callout `.important`** répétant la règle "ne jamais modifier une entrée existante,
   uniquement en ajouter en tête du chantier concerné" et le format de ligne attendu :
   `Date | Hash | Résumé`.
3. **Une `<h2>` par chantier**, titre au format `{{Nom du chantier}} ({{date de la dernière
   entrée}})`, suivie **optionnellement** d'un paragraphe de contexte quand le chantier a besoin
   d'être resitué (ex. signalé par qui, pourquoi il a démarré) — pas nécessaire pour un chantier
   qui s'explique déjà par son titre.
4. **Un tableau par chantier**, colonnes `Date` / `Hash` / `Résumé`, une ligne par
   commit/événement notable (une publication, un diagnostic mené sans commit associé peuvent
   aussi avoir une ligne avec `n/a` en hash et une précision entre parenthèses). Lignes triées de
   la plus récente à la plus ancienne. Le résumé peut utiliser `<strong>` pour marquer une
   décision actée au milieu d'une entrée plus longue (ex. plusieurs échanges de conception
   successifs sur un même chantier, chacun sur sa ligne, la ligne la plus récente contenant la
   synthèse des décisions finales).
5. Un chantier peut être un **diagnostic ponctuel** (bug signalé → cause trouvée → correctif) et
   pas seulement une fonctionnalité — même format `<h2>` + tableau.

#### `ROADMAP.html` — statut et design des chantiers restants

Ordre après le `<h1>Roadmap</h1>` et `<p class="muted">Dernière revue : {{date}}</p>` :

1. **Paragraphe de renvoi** : ce qui est déjà livré est dans `AI-HISTORY.html`, les pièges/
   invariants du code déjà en place sont dans `AI-CONTEXT.html` — cette page ne répète ni l'un ni
   l'autre, uniquement ce qui reste à faire ou à décider.
2. **`<h2>Vue d'ensemble</h2>`** : un tableau `Chantier` / `Statut` / `Priorité`, une ligne par
   chantier, où la colonne `Chantier` est un lien d'ancre (`#id-du-chantier`) vers son détail plus
   bas, et `Statut` utilise les pastilles (voir tableau ci-dessous). Ces colonnes ne tiennent que
   **tant que le détail vit sur la même page** : si la roadmap est éclatée en pages de détail
   (Règle 1), le tableau devient un index de renvois et perd `Statut`/`Priorité`.
3. **Sections de détail par groupe**, dans cet ordre stable : `<h2>Phase 1 — {{priorité}}</h2>`,
   `<h2>Phase 2 — {{priorité}}</h2>`, `<h2>Non daté — à faire quand utile</h2>`,
   `<h2>Hors périmètre</h2>` — n'inclure que les phases pertinentes pour le projet, mais garder
   "Hors périmètre" en dernier quand des idées ont été explicitement écartées (utile pour ne pas
   les reproposer plus tard sans savoir qu'elles ont déjà été tranchées).
4. **Un `<h3 id="...">` par chantier** à l'intérieur d'une phase, avec :
   - un paragraphe de design aussi détaillé que possible (les choix d'architecture/UX déjà
     tranchés, pas seulement une intention vague) ;
   - une liste à puces des sous-décisions ou contraintes identifiées, une puce par point ;
   - une **note `.muted`** finale si un point précis reste à vérifier au moment de
     l'implémentation (ex. "mécanique exacte du bouton à confirmer") — distingue ce qui est
     tranché de ce qui reste ouvert ;
   - un **callout `.important`** quand le chantier a été explicitement sorti du périmètre
     (section "Hors périmètre") ou quand une décision de scope a été actée après hésitation —
     le callout porte le "pourquoi" de la décision, pas seulement le "quoi".

### Conventions transverses (ancres, callouts, pastilles)

Ces conventions s'appliquent aux 4 pages et doivent rester identiques d'un projet à l'autre pour
que la lecture soit immédiate même en changeant de projet.

**Identifiants stables (jamais réutilisés, jamais renumérotés)**

| Convention | Usage |
|---|---|
| `id="piege-N"` | Ancre d'un piège dans `AI-CONTEXT.html`. `N` est attribué une fois et ne bouge plus, même si l'ordre d'affichage change — référencé depuis `CLAUDE.md` et `ROADMAP.html` par son numéro. |
| `id="cat-{{slug}}"` | Ancre d'une catégorie dans `AI-CONTEXT.html`, ciblée depuis le sommaire de la même page. |
| `id="{{slug-du-chantier}}"` | Ancre d'un chantier dans `ROADMAP.html`, ciblée depuis le tableau "Vue d'ensemble" de la même page et, ponctuellement, depuis `AI-CONTEXT.html` pour renvoyer vers le design prévu d'un point fragile. |

**Compteur de numérotation.** Une numérotation stable suppose de connaître le dernier numéro
attribué — information qu'aucune lecture partielle ne donne, puisque l'ordre d'affichage ne suit pas
la numérotation. Chaque document concerné indique donc **en tête, sous le sommaire, le prochain
numéro libre** (`Prochain piège : #22`), et celui qui ajoute une entrée l'incrémente dans le même
geste. Sans ce compteur, le réflexe par défaut — reprendre le dernier numéro visible en fin de
fichier — produit des collisions silencieuses avec des numéros déjà attribués plus haut. Rappel : un
numéro libéré par un archivage reste consommé, le compteur ne redescend jamais.

**Callouts (`.callout.{{type}}`)**

| Classe | Sens | Exemple d'usage |
|---|---|---|
| `.note` | Information neutre, légende, précision qui aide à lire la suite. | Expliquer une convention de pastille en haut d'`AI-CONTEXT.html`. |
| `.warning` | Piège opérationnel actif à surveiller — quelque chose qui *peut se reproduire* si on n'y prend pas garde. | "Telle action dans l'UI supprime silencieusement tel fichier de config." |
| `.important` | Décision actée, règle non négociable, ou risque élevé (perte de données, sécurité). | Règle de détection de dérive, décision de sortir un chantier du périmètre, garde-fou sur une donnée sensible. |

**Pastilles de statut (`.pill.{{type}}`)**

| Classe | Sens |
|---|---|
| `.done` (✅ Livré) | Chantier **validé par l'utilisateur en conditions réelles** (pas seulement codé — voir Règle 4) **et effectivement en service** : déployé en production, publié et installé, ou fusionné sur la branche principale selon la nature du projet. Un code validé qui dort sur une branche n'est pas livré. Rappel : tant que cette validation n'est pas venue, le chantier ne reçoit aucune écriture dans `ROADMAP.html`/`AI-HISTORY.html`, pas même une ligne d'état intermédiaire. |
| `.adopted` (🎯 Adopté) | **Réservé aux chantiers d'outillage et de convention** (script, commande, workflow, tracker, convention d'écriture) : l'outil est livré *et* son usage est **constaté dans le flux de travail réel**. Une démonstration réussie ne suffit pas, il faut une trace d'emploi. Pour une fonctionnalité livrée à des utilisateurs, `.done` reste l'état terminal — ne pas attendre un second feu vert qui ne viendra jamais. |
| `.progress` (🚧) | Chantier en cours de développement actif. |
| `.planned` (📋) | Design discuté et au moins partiellement tranché, pas encore codé. Nuancer le libellé selon l'avancement de la réflexion ("Proposé" / "Mécanisme tranché" / "Design validé"). |
| `.out` (⛔) | Explicitement écarté ou sorti du périmètre du projet — toujours accompagné d'un callout `.important` expliquant pourquoi. |
| `.warn` (⚠️) | Marque, dans `AI-CONTEXT.html`, un piège qui dépend d'un comportement non contractuel d'une dépendance externe — à revérifier après une mise à jour de cette dépendance. |

## Règle 3 — Garder `CLAUDE.md` à jour, en cohérence avec la mémoire persistante

- Chaque projet garde un `CLAUDE.md` à sa racine (auto-chargé par Claude Code) qui reste la
  **référence rapide** : commandes de build/dev, particularités d'installation, et surtout une
  consigne explicite de lire `.AIRules/README.html` en début de session avant tout le reste.
  Il ne duplique pas le contenu détaillé déjà présent dans `.AIRules/` (pièges, roadmap,
  historique) — seulement des pointeurs vers ces fichiers.
- Si plusieurs projets cohabitent dans un même workspace, un `CLAUDE.md` à la racine du
  workspace référence chacun d'eux et pointe vers son `.AIRules/README.html`, pour qu'une
  session ouverte à ce niveau (plutôt que dans un projet précis) sache où aller chercher le
  contexte.
- `CLAUDE.md` doit être mis à jour **dès qu'une convention de code, une commande de build ou un
  piège d'environnement change** — pas en fin de session, au moment où le changement est fait.
- La mémoire persistante inter-conversations (`~/.claude/projects/.../memory/`) est
  **complémentaire, pas redondante** avec `CLAUDE.md`/`.AIRules` :
  - `CLAUDE.md` et `.AIRules/` portent tout ce qui est **spécifique au projet et versionné avec
    le code** (pièges techniques, roadmap, historique de commits) — dérivable et vérifiable
    depuis le dépôt lui-même.
  - La mémoire porte ce qui est **transverse aux projets et propre à la collaboration** :
    préférences de l'utilisateur, retours d'expérience sur la façon de travailler ensemble,
    état d'avancement à connaître avant même d'ouvrir un projet, pointeurs vers des systèmes
    externes.
  - Si une information censée vivre dans la mémoire s'avère en fait dérivable du code ou déjà
    documentée dans `.AIRules/`/`CLAUDE.md`, elle n'a pas sa place en mémoire — et
    inversement, un retour d'expérience utilisateur sur la manière de collaborer ne doit pas
    finir enterré dans un `AI-CONTEXT.html` où il ne sera relu que pour ce projet précis.
- **Point mémoire de fin de session** : avant tout effacement de contexte, faire un bilan
  explicite de la mémoire persistante — ce qui a été appris sur la façon de collaborer, ce qui a
  changé dans l'état d'avancement, ce qui s'est révélé faux dans une mémoire existante. Une
  mémoire contredite par un retour plus récent **se réécrit ou se supprime** ; elle ne cohabite
  pas avec la version périmée, sous peine de rendre l'ensemble non fiable.
- **Métadonnées d'attribution IA dans les messages de commit** : trancher **une fois par dépôt**,
  avant le premier push, si les commits peuvent porter des métadonnées d'attribution IA
  (co-auteur, lien de session, mention de l'outil) — et écrire la décision dans le `CLAUDE.md` du
  projet, pour qu'elle n'ait pas à être rediscutée à chaque commit. Sur un dépôt public, ces
  métadonnées exposent un historique de collaboration qui n'était pas forcément destiné à être
  publié : c'est une décision de l'auteur du dépôt, pas un réglage d'outil.

## Règle 4 (transversale) — Discipline de vérification, valable pour tout projet

Ces règles ne sont spécifiques à aucune techno en particulier ; elles s'appliquent à toute
session de travail sur tout projet et sont donc documentées ici plutôt que répétées dans chaque
`AI-CONTEXT.html` projet.

- **Détection de dérive** : si l'état réel du code contredit un invariant documenté (méthode
  renommée, comportement différent, statut de chantier faux), ne pas coder par-dessus
  l'hypothèse périmée — corriger la documentation d'abord, puis continuer.
- **Validation utilisateur avant "fait"** : ne jamais marquer une fonctionnalité comme terminée
  dans un journal ou une roadmap avant que l'utilisateur ait explicitement confirmé qu'elle
  fonctionne en conditions réelles (test réel, pas seulement une relecture de code). Cette règle
  ne porte pas seulement sur la pastille `.done` : tant que la validation n'est pas venue, le
  chantier ne reçoit **aucune écriture** dans le journal ou la roadmap, pas même une ligne d'état
  intermédiaire. Un build qui passe, un déploiement réussi ou une relecture de code ne valent pas
  validation. Cas particulier des chantiers d'**outillage et de convention** : ils disposent d'un
  état terminal supplémentaire, `.adopted` (Règle 2), qui demande un **usage constaté** et non une
  démonstration réussie. Un outillage resté `.done` sans usage constaté est un signal en soi : soit
  il est adopté, soit on acte qu'il ne sert pas — en le sortant du périmètre avec le callout
  `.important` qui dit pourquoi, plutôt qu'en le laissant afficher un statut littéralement vrai et
  pratiquement faux.
- **Données jetables pour tout test destructif** : toute manipulation touchant des données réelles
  de l'utilisateur ou de production se teste d'abord sur des entrées jetables clairement
  identifiables (ex. préfixe `test-*`/`sandbox-*`), jamais directement sur les vraies données —
  même quand le risque semble faible.
- **Vérifier un export d'API à deux niveaux** : pour savoir si une classe/un composant d'une
  dépendance externe est réellement utilisable depuis le code du projet, un tag `@hidden`/`@internal`
  ou l'état des typings ne suffit pas — vérifier à la fois la documentation/les typings **et** le
  comportement réel à l'exécution (bundle compilé, réponse d'API réelle...). Un champ ou une
  signature peut différer entre les deux.
- **Sauvegarder puis `diff` avant de conclure** : toute modification scriptée d'un fichier de
  l'utilisateur (config, données) se fait après copie de sauvegarde, et se termine par un `diff`
  contre cette sauvegarde — pas par une simple relecture de la partie qu'on croit avoir touchée.
  Certains dégâts sont totalement silencieux et hors de la zone éditée. Vécu le 2026-07-28 : des
  éditions PowerShell ont corrompu un chemin accentué situé 400 lignes plus loin que la section
  visée, sans la moindre erreur.
- **Windows : ne pas réécrire un fichier accentué avec PowerShell 5.1.** `Get-Content` +
  `Set-Content -Encoding utf8` ne fait pas un aller-retour UTF-8 propre — chaque cycle ré-encode les
  caractères non-ASCII (l'effet se cumule) et ajoute un BOM. Passer par Node
  (`readFileSync`/`writeFileSync` en `'utf8'`) ou un outil équivalent. PowerShell reste approprié
  pour piloter des process (`Start-Process`, `Stop-Process`), pas pour réécrire du contenu.
- **Test manuel d'abord, automatisation de la mesure en dernier recours.** Quand une vérification
  tient en quelques clics ou saisies dans une interface que l'utilisateur a sous la main, lui
  fournir une **checklist de test manuel précise** (quoi faire, quel résultat attendre, comment
  vérifier la persistance) et rester en **écoute passive** sur les traces (logs, fichiers de
  configuration, sorties de process). Écrire un script d'automatisation d'interface pour un geste
  ponctuel coûte largement plus cher que le geste lui-même, et l'utilisateur préfère généralement
  le faire — une fois qu'il a demandé à piloter l'application lui-même, ne plus simuler ses
  actions. N'escalader vers un **banc de mesure automatisé** (pilotage du navigateur ou de
  l'application, instrumentation temporaire, capture de géométrie) que dans trois cas : (a) deux
  ou trois hypothèses successives ont déjà été invalidées manuellement sans que la cause
  n'apparaisse — arrêter alors de proposer des correctifs à l'aveugle ; (b) le volume de
  vérifications dépasse ce qu'un humain fera raisonnablement ; (c) l'utilisateur le demande
  explicitement. Dans ces cas l'investissement est décisif : il révèle les bugs à causes
  multiples, qu'une série de correctifs partiels ne peut par construction jamais valider.
- **Ne pas trancher un compromis à la place de l'utilisateur.** Quand deux options s'opposent sur
  l'axe sûreté/complétude (une variante partielle mais sans risque contre une variante complète
  mais susceptible d'endommager des données ou un état existant), ne pas supposer que
  l'implémentation la plus complète est attendue : exposer les deux, dire laquelle est
  recommandée et pourquoi, et laisser le choix.
- **Chercher une bibliothèque établie avant d'écrire un utilitaire maison.** Pour tout besoin
  d'outillage qui paraît simple (assainissement d'entrées, échappement, parsing, formats de date,
  jeux de données de référence, icônes), vérifier d'abord s'il existe une bibliothèque ou un jeu
  de données reconnu et maintenu, et le proposer — le code maison sur ces sujets est un nid de
  failles et de cas limites oubliés. Ne partir sur une implémentation propre qu'après avoir
  constaté qu'aucune option établie ne couvre le besoin, et le dire explicitement.

## Règle 5 — Statusline Claude Code systématique (config globale de session)

Chaque environnement de travail (une seule fois par machine, pas par projet — cette config vit
dans `~/.claude/settings.json`, hors de tout dépôt Git) doit avoir une statusLine configurée pour
garder en permanence sous les yeux le niveau de consommation de contexte et de quota, sans avoir à
le demander explicitement.

Ni `~/.claude/settings.json` ni le script ne sont versionnés où que ce soit : **les deux blocs
ci-dessous sont leur seule sauvegarde**, et c'est à ce titre qu'ils figurent intégralement ici,
recopiables tels quels sur une machine neuve.

### Config — `~/.claude/settings.json`

```json
"statusLine": {
  "type": "command",
  "command": "bash ~/.claude/statusline-command.sh",
  "refreshInterval": 5
}
```

`refreshInterval` (en secondes) ajoute un rafraîchissement périodique **en plus** des mises à jour
événementielles déjà déclenchées par Claude Code (démarrage/reprise de session, nouveau message
assistant, `/compact`, changement de permission mode, bascule vim mode...) — ce n'est pas un réglage
de debounce sur ces événements, il n'en existe pas de documenté. Concrètement, tant que la session
est inactive, le script est relancé toutes les N secondes. Comme le script spawn un process Node qui
exécute lui-même un `execSync("git branch...")`, une valeur trop basse (`1`) fait tourner ce
processus en continu en arrière-plan, pour un gain d'affichage nul — une variation de quota à la
seconde près n'a aucune valeur pratique. `5` reste réactif sans ce coût.

### Script — `~/.claude/statusline-command.sh`

Le script lit sur stdin le JSON fourni par Claude Code (`model`, `workspace.current_dir`,
`context_window.used_percentage`, `rate_limits.five_hour` / `seven_day`). Il doit être exécutable
(`chmod +x`). Le wrapper bash n'existe que pour déléguer à Node : les caractères de barre (`█`,
`░`) et les séquences ANSI passent mal par un shell Windows, pas par Node.

```bash
#!/usr/bin/env bash
# Claude Code statusLine:
# [barre] pct% Tkn | Branche (ou Modele si pas de repo git)
# [barre] pct% 5H  | temps avant reset
# [barre] pct% 7D  | temps avant reset (jours seuls si > 24h)
# Texte en blanc, barres en vert/orange/rouge selon le niveau.

node -e '
const { execSync } = require("child_process");

let input = "";
process.stdin.on("data", d => input += d);
process.stdin.on("end", () => {
  let data;
  try { data = JSON.parse(input); } catch { data = {}; }

  const RESET = "\x1b[0m";
  const DIM = "\x1b[2m";
  const WHITE = "\x1b[97m";
  const GREEN = "\x1b[32m";
  const YELLOW = "\x1b[33m";
  const RED = "\x1b[31m";

  const now = Math.floor(Date.now() / 1000);

  function pctColor(pct) {
    if (pct >= 80) return RED;
    if (pct >= 50) return YELLOW;
    return GREEN;
  }

  function bar(pct, width = 10) {
    const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
    const empty = width - filled;
    return `${pctColor(pct)}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
  }

  function fmtTime(resetsAt, allowDaysOnly) {
    let diff = resetsAt - now;
    if (diff < 0) diff = 0;
    if (allowDaysOnly && diff > 86400) {
      const days = Math.floor(diff / 86400);
      return `${days}j`;
    }
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }

  function gitBranch(cwd) {
    if (!cwd) return null;
    try {
      return execSync("git branch --show-current", { cwd, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() || null;
    } catch {
      return null;
    }
  }

  const model = (data.model && data.model.display_name) || "?";
  const cwd = data.workspace && data.workspace.current_dir;
  const branch = gitBranch(cwd);
  const rightLabel = branch ? `${model} ${DIM}·${RESET}${WHITE} ${branch}` : model;

  const ctx = data.context_window || {};
  const ctxPct = typeof ctx.used_percentage === "number" ? Math.round(ctx.used_percentage) : null;

  function row(pct, label, rightText) {
    const pctStr = String(Math.round(pct)).padStart(3);
    return `${WHITE}[${bar(pct)}]${RESET} ${WHITE}${pctStr}% ${label}${RESET} ${WHITE}|${RESET} ${WHITE}${rightText}${RESET}`;
  }

  const line1 = ctxPct === null
    ? `${WHITE}${rightLabel}${RESET}`
    : row(ctxPct, "Tkn", rightLabel);

  const rl = data.rate_limits || {};

  function usageRow(label, entry, allowDaysOnly) {
    if (!entry || typeof entry.used_percentage !== "number") return null;
    const pct = Math.round(entry.used_percentage);
    const time = typeof entry.resets_at === "number" ? fmtTime(entry.resets_at, allowDaysOnly) : "--";
    return row(pct, label, time);
  }

  const lines = [
    line1,
    usageRow("5H ", rl.five_hour, false),
    usageRow("7D ", rl.seven_day, true),
  ].filter(Boolean);

  process.stdout.write(lines.join("\n"));
});
'
```

- Si l'entrée `statusLine` ou le script disparaît de `~/.claude/` (réinstallation, nouvelle machine,
  settings écrasés), **le recréer depuis les deux blocs ci-dessus** plutôt que d'improviser un format
  différent — la valeur vient de la cohérence d'affichage d'un environnement à l'autre, pas du détail
  exact du rendu.
- Corollaire : toute évolution volontaire du script se reporte **ici en même temps**, sinon la copie
  de référence devient fausse sans que rien ne le signale.

## Règle 6 — Une idée passe par la roadmap avant de passer par le code

Quand l'utilisateur exprime une idée en vrac (a fortiori plusieurs d'un coup), le réflexe par
défaut n'est **pas** de coder : c'est de la consigner dans `ROADMAP.html` avec la pastille
`.planned`, d'y étudier la faisabilité et d'y écrire le design proposé — puis d'attendre son
arbitrage. Ne démarrer l'implémentation que sur une consigne explicite (« implémente », « vas-y »).

Corollaire sur la forme : tout changement structurant (refonte d'un document de gouvernance, choix
d'architecture, changement de convention) se présente sous forme de **propositions numérotées et
individuellement validables**, avec pour chacune le texte ou le comportement exact qui en
résulterait — pas sous forme de modification déjà appliquée qu'il faudrait relire pour la
contester. L'utilisateur valide par numéros ; seules les propositions retenues sont écrites.

## Règle 7 — Transposer ou remettre à niveau une gouvernance existante

Deux situations distinctes, à ne pas traiter de la même façon :

- **Cas A — la connaissance projet existe, mais sous un autre format** (`CLAUDE.md` devenu
  fourre-tout, notes Markdown, wiki, tickets, rien du tout de structuré) : il s'agit de la
  transposer vers `.AIRules/`. Voir les étapes 1 à 7 ci-dessous.
- **Cas B — le projet a déjà un `.AIRules/` au format, mais il a dérivé** (invariants devenus
  faux, chantiers marqués faits sans validation réelle, roadmap qui décrit un design abandonné,
  charte de gouvernance revue depuis) : il s'agit de le remettre à niveau, pas de le refaire.
  Voir la section « Cas B » en fin de règle.

### Cas A — transposer un existant vers le format `.AIRules/`

Un projet déjà en cours a rarement une page blanche : il a un `CLAUDE.md` qui a gonflé, un
`README` fourre-tout, des notes en Markdown, un `docs/`, un wiki, des tickets, des `TODO` en
commentaire, un historique Git. La migration consiste à **redistribuer** cet existant, pas à le
réécrire de zéro ni à le recopier tel quel.

#### Étape 1 — Inventorier les sources avant de créer quoi que ce soit

Lister tout ce qui porte aujourd'hui de la connaissance projet (fichiers de doc, sections de
`README`, tickets ouverts, `git log`, conversations passées si elles sont accessibles). Cet
inventaire est court mais il conditionne le reste : on ne migre bien que ce qu'on a vu.

#### Étape 2 — Trier par nature d'information, pas par fichier d'origine

Chaque élément trouvé a une destination et une seule. Le critère est la nature de l'information :

| Nature de l'information trouvée | Destination |
|---|---|
| Fait technique stable, contrainte d'environnement, piège déjà rencontré | `AI-CONTEXT.html` (piège numéroté ou puce de catégorie) |
| Événement daté, commit notable, diagnostic mené | `AI-HISTORY.html` |
| Ce qui reste à faire, idée non tranchée, décision de périmètre | `ROADMAP.html` |
| Commande de build/test/install, particularité d'installation | reste dans `CLAUDE.md` (référence rapide) |
| Préférence de collaboration, retour d'expérience sur la façon de travailler | mémoire persistante (Règle 3) |
| Information dérivable du code en le lisant, ou périmée | **supprimée, pas migrée** |

La dernière ligne est la plus importante : une migration réussie *réduit* le volume de doc. Tout
ce qui est recopié « au cas où » devient une source de vérité concurrente qui dérivera.

#### Étape 3 — Vérifier avant d'inscrire, ne jamais recopier de confiance

Une doc existante est souvent périmée sans que personne ne l'ait remarqué. Toute affirmation
reprise d'une source ancienne se **re-vérifie contre le code réel** avant d'être inscrite comme
invariant (la règle de détection de dérive s'applique pendant la migration elle-même). Ce qui n'a
pas pu être vérifié n'est pas jeté pour autant : il est inscrit avec la pastille `.warn` et une
mention explicite « repris de l'ancienne doc, non revérifié » — visible, donc corrigeable.

#### Étape 4 — Reconstruire l'historique sans y passer la semaine

Quand il n'existe aucun journal, `AI-HISTORY.html` se reconstruit depuis `git log` — mais **par
chantier, pas commit par commit** : regrouper les commits en chantiers cohérents, une `<h2>` par
chantier, et n'y détailler que les lignes qui portent une décision ou un piège. Tout ce qui
précède la mise en place de la gouvernance peut tenir en un seul chantier
`Avant la gouvernance ({{période}})` avec quelques lignes de jalons. L'exhaustivité rétroactive
n'a aucune valeur ; la reprise du fil en a une.

#### Étape 5 — Geler la numérotation à la migration

Les numéros `#N` des pièges sont attribués **au moment de la migration**, dans l'ordre où on les
rencontre, puis gelés définitivement (voir « Conventions transverses » → « Identifiants stables »
dans la Règle 2). Ne pas chercher à les faire
correspondre à un ordre chronologique ou à une numérotation qui existait ailleurs.

#### Étape 6 — Ordre de migration recommandé

`AI-CONTEXT.html` d'abord (valeur immédiate : c'est ce qui évite de retomber dans un piège dès la
session suivante), puis `ROADMAP.html` (ce qui reste à faire est généralement encore frais), puis
`README.html`, et `AI-HISTORY.html` en dernier — le plus coûteux à reconstituer et le moins urgent.
Une gouvernance partielle mais juste vaut mieux qu'une migration complète repoussée.

#### Étape 7 — Élaguer les sources d'origine, puis faire valider

Une fois le contenu déplacé, **retirer** les sections migrées de leur emplacement d'origine et y
laisser un pointeur d'une ligne vers `.AIRules/` : deux emplacements qui décrivent la même chose
divergeront. Enfin, la migration est une **proposition** — `AI-HISTORY.html` et `ROADMAP.html` ne
sont pas écrits sans le feu vert de l'utilisateur (Règle 2), et une transposition est typiquement
le moment où lui présenter le mapping envisagé avant d'écrire.

### Cas B — remettre à niveau un `.AIRules/` existant qui a dérivé

Une gouvernance au bon format n'est pas pour autant une gouvernance juste. Elle vieillit :
le code bouge, les chantiers avancent, la charte elle-même est révisée. Une remise à niveau est
un **audit page par page**, pas une réécriture — le format ne change pas, seul le contenu faux
est corrigé.

#### Quand la déclencher

Plutôt qu'une périodicité fixe (qu'on ne tient jamais), une liste de déclencheurs :

- **reprise du projet après une longue interruption** — c'est le cas le plus courant, et le plus
  dangereux : la doc paraît fiable justement parce qu'elle n'a pas bougé ;
- **montée de version majeure d'une dépendance centrale** (framework, runtime, plateforme hôte) —
  rejouer en priorité les pièges marqués `.warn`, qui existent précisément parce qu'ils dépendent
  d'un comportement non contractuel de cette dépendance ;
- **arrivée d'un nouveau contributeur, humain ou assistant, sur le projet** — la première lecture
  extérieure est le meilleur détecteur de contenu périmé ;
- **révision de la charte de gouvernance elle-même** (voir « Suivre les révisions de la charte »
  ci-dessous) ;
- **dérive constatée en cours de session ordinaire** — dans ce cas, ne pas repousser à une revue
  générale future : corriger immédiatement le point constaté (c'est la règle de détection de
  dérive de la Règle 4), quitte à planifier la revue complète séparément.

#### Que vérifier, page par page

- **`AI-CONTEXT.html`** — confronter chaque invariant au code réel. Un piège **résolu depuis
  longtemps se conserve quand même** : il documente pourquoi le code est écrit ainsi, et le
  supprimer invite à refaire l'erreur. Un piège devenu **faux** (l'API a changé, le contournement
  n'est plus nécessaire) se corrige en place, en disant ce qui a changé et depuis quand — jamais
  de suppression silencieuse. Les numéros `#N` ne bougent pas, même si une entrée est vidée de sa
  substance.
- **`ROADMAP.html`** — confronter chaque pastille à l'état réel du dépôt. Un `.done` dont on ne
  trouve **aucune trace de validation utilisateur** redescend en `.progress` : « le code est là »
  n'a jamais valu « c'est fait » (Règle 4). Un chantier `.planned` dont le design ne convainc plus
  rejoint « Hors périmètre » **avec le callout `.important` qui dit pourquoi** — sans quoi il sera
  reproposé six mois plus tard.
- **`AI-HISTORY.html`** — ne rien corriger rétroactivement : les entrées existantes ne se
  modifient jamais, même fausses. Ajouter une entrée datée qui **acte la revue et les écarts
  constatés** ; l'écart entre ce qu'on croyait et ce qui était est lui-même une information utile.
- **`README.html`** — vérifier que le protocole de démarrage décrit toujours la réalité du projet
  (commandes, dépendances, discipline de test) et que sa date de conformité à la charte est à jour.

Une remise à niveau se termine par la **mise à jour effective des lignes « Dernière revue »** des
pages concernées. Une date qui ne bouge pas signifie que la revue n'a pas eu lieu — c'est le seul
signal dont dispose le lecteur suivant.

#### Suivre les révisions de la charte

La présente charte évolue, et les projets qui l'ont adoptée ne se mettent pas à niveau tout seuls.

- Le `<footer>` de chaque `README.html` projet porte, à côté de la date de restructuration de sa
  gouvernance, la mention **« Conforme à la charte de gouvernance du {{date}} »** — la date du
  pied de page de ce fichier au moment de l'adoption ou de la dernière remise à niveau.
- En début de session sur un projet dont cette date est **antérieure à la dernière révision de la
  charte**, signaler l'écart et proposer la remise à niveau (Cas B) — en listant ce qui a changé
  dans la charte entre-temps.
- **Ne pas l'appliquer d'office** : un projet peut légitimement rester sur une convention
  antérieure (projet en fin de vie, convention volontairement figée, révision non pertinente pour
  lui). La mise à niveau est une proposition, comme tout changement structurant (Règle 6).

## Index des projets d'un workspace

Quand ce fichier est placé à la racine d'un workspace regroupant plusieurs projets, tenir ici la
liste des projets et le lien vers leur `.AIRules/README.html` respectif :

| Projet | Gouvernance |
|---|---|
| `{{nom-du-dossier}}` | [`{{nom-du-dossier}}/.AIRules/README.html`](./{{nom-du-dossier}}/.AIRules/README.html) |

**Ce gabarit reste vide ici** : cette charte est un document canonique partagé, poussé tel quel
dans n'importe quel projet ou workspace — elle ne doit citer aucun projet actif, aucun nom de
dépôt, aucune URL réelle. L'instanciation concrète (la vraie liste de projets d'*un* workspace
donné) vit dans le `CLAUDE.md` de ce workspace (Règle 3), jamais dans la copie locale de
`GOUVERNANCE-IA.md`.

---
*Dernière mise à jour de cette charte : **2026-07-31** (révision issue d'un audit de gouvernance
grandeur nature, où chacun des points ci-dessous avait produit du faux, de l'ambigu ou du
non-décidable. Règle 1 : **éclatement d'une page principale** en pages de détail dans un sous-dossier
dédié, la page éclatée devenant un index de renvois qui ne porte aucun statut ; critère de **chaîne
de liens continue** pour les annexes, en remplacement du « lien depuis l'une des quatre pages » que
tout éclatement rendait faux ; **note d'annexe** pour les pièces que leur format ou leur poids empêche
de porter un lien de retour, et pour les ressources délibérément hors dépôt ; archives — le contenu
reste intouchable mais les **liens de navigation se réparent**, en trois cas explicites dont celui de
la cible disparue ; colonne `Hash` d'`AI-HISTORY.html` ramenée à **trois valeurs** dont le marqueur
`(commit en cours)`, dont le remplacement par le hash réel devient la seule modification autorisée
d'une entrée existante. Règle 2 : pastille **`.adopted`** pour les chantiers d'outillage et de
convention, distinguant l'outil qui fonctionne de l'outil dont l'usage est constaté, et `.done`
resserrée sur « validé en conditions réelles **et** effectivement en service » ; **compteur de
numérotation** en tête des documents à numérotation stable, sans lequel la règle demande de connaître
un état qui n'est écrit nulle part. Règle 4 : pour l'outillage, usage constaté plutôt que
démonstration réussie.).*

*Révision précédente : **2026-07-30** (préambule : la charte est la référence à tout
moment et est susceptible d'évoluer ; Règle 1 : dossiers optionnels `annexes/` et `archive/`, dépôt
canonique public `Claude-Governance` et mécanisme de vérification périodique par cron avec
propagation sur branche et validation humaine, clarification de l'épuisement d'un fichier
`.tempfiles/` avant suppression ; Règle 2 : navbar réservée aux quatre pages principales, squelette
des pages de sous-dossier, liens internes toujours relatifs, discipline d'édition ciblée + validation
de syntaxe sur les pages volumineuses ; Règle 5 : script de statusline intégré verbatim comme copie
de référence, `refreshInterval` corrigé de `1` à `5` et sa justification réécrite après vérification
de la documentation officielle (ce n'est pas un réglage de debounce) ; Index des projets d'un
workspace : retrait de l'instanciation concrète — ce document canonique ne doit citer aucun projet
actif, seul le gabarit vide reste, l'index réel vivant dans le `CLAUDE.md` de chaque workspace ;
mécanisme de vérification par cron : précision sur l'exécution silencieuse (fenêtre de tâche
planifiée masquée ≠ fenêtre du processus lancé, distinction à garder quand le script cron est
lui-même un exécutable à console).*

*Révision antérieure : **2026-07-29** (Règle 1 : ajout des trois questions à poser au SETUP d'un
nouveau projet — nom du dépôt distant, privé ou public, authentification `gh` en place).*

*Révision antérieure : **2026-07-28** (ajout des Règles 6 et 7 — cette dernière couvrant à la fois
la transposition d'un existant et la remise à niveau d'un `.AIRules/` qui a dérivé —, révision des
cadences d'écriture de la Règle 2 et de la discipline de vérification de la Règle 4).*

*C'est cette date que reprend la mention « Conforme à la charte de gouvernance du {{date}} » dans
le pied de page des `README.html` projet.*
