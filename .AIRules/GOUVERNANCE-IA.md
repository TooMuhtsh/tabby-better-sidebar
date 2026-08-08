# Gouvernance IA — charte pour projets de développement

Cette charte décrit comment se gouverne un projet de développement assisté par IA :
où vit la connaissance du projet, qui a le droit de l'écrire, et à quel moment. Elle
s'applique **indépendamment du langage, du framework ou de la nature du logiciel**
(application, bibliothèque, plugin, service).

Elle s'utilise dans quatre situations :

- un **nouveau projet**, dès sa création ;
- un **projet existant sans gouvernance formalisée** ;
- un projet dont la gouvernance **existe sous une autre forme** (fichier d’instructions
  devenu fourre-tout, notes Markdown, wiki, tickets) et qu'il s'agit de transposer ;
- un projet **déjà au format `.AIRules/` mais dont le contenu a dérivé**, ou resté conforme
  à une révision antérieure de cette charte.

## Comment lire cette charte

Elle est en trois parties, et la distinction entre elles est le cœur du document :

| Partie | Ce qu'elle contient | Autorité |
|---|---|---|
| **A — Noyau** | Ce qui s'impose à tout projet gouverné par cette charte. | Prescriptif. Un projet qui n'applique pas le noyau n'applique pas cette charte. |
| **B — Options** | Ce qui se décide projet par projet. Chaque option porte ses valeurs possibles, son défaut, et **le pourquoi de ce défaut**. | Chaque projet arbitre. Le défaut s'applique s'il ne le fait pas. |
| **C — Entretien de cadrage** | Quand poser les questions de la partie B, dans quel ordre, et où s'écrivent les réponses. | Procédural. |

Une quatrième pièce vit à côté, dans un fichier séparé : **`GABARITS.md`** porte les
squelettes de documents (HTML et Markdown), la table de conversion entre les deux, et le
modèle de `PROFIL.md`. Il est volontairement **hors de ce fichier** : on ne le lit qu'au
moment de créer ou de restructurer un document, jamais en début de session. Il voyage
avec la charte, dans le même `.AIRules/`.

### Les identifiants de cette charte sont stables

Les identifiants d'invariant (`A-1`…`A-15`) et les clés d'option (`format`, `seuil`…) sont
**attribués une fois et ne bougent plus** — c'est exactement ce qu'A-6 impose aux projets,
et la charte n'en est pas dispensée. Ils sont cités des dizaines de fois ici même, dans les
gabarits, et depuis les documents de chaque projet ; une renumérotation les casserait tous
en silence.

**Prochain numéro d'invariant libre : `A-16`.** A-6 exige qu'un document à numérotation
stable porte cette information en tête, et la charte ne s'en dispense pas plus que du
reste : l'ordre d'affichage ne suivant pas la numérotation, aucune lecture partielle ne
donne le dernier numéro attribué. Celui qui ajoute un invariant l'incrémente dans le même
geste.

Conséquences pour une révision future :

- un invariant ajouté prend le **numéro suivant**, quelle que soit sa place logique dans le
  document — l'ordre de lecture peut donc diverger de l'ordre numérique, et c'est le prix à
  payer ;
- un invariant retiré **laisse son numéro consommé** ; il ne se réattribue jamais ;
- une option renommée est une **option nouvelle**, l'ancienne clé restant documentée comme
  abandonnée le temps que les `PROFIL.md` migrent.

### Ce fichier reste la référence, à tout moment

La charte ne se lit pas seulement au moment d'un SETUP ou d'une mise en conformité :
**elle est la référence pendant toute session, sur tout projet**, y compris quand la
session démarre directement dans un projet. En cas de contradiction entre elle et un
le fichier d’instructions, un document de gouvernance ou une habitude prise en route, c'est
elle qui tranche — et la contradiction elle-même est à signaler plutôt qu'à contourner
(A-5, détection de dérive).

### Identifiant de version

La charte **évolue** : une révision peut ajouter, réécrire ou retirer un élément. Chaque
révision porte un **identifiant horodaté** au format `AAAAMMJJ-HHMMSS`, en UTC, généré au
moment où la révision est figée :

```
20260731-150737
```

C'est le numéro de version, et le seul. Il est **monotone** (une version postérieure est
toujours supérieure), **sans collision possible** — y compris pour deux révisions le même
jour, ce qu'une simple date ne savait pas exprimer —, se compare par une **comparaison de
chaînes** sans rien parser, et reste lisible comme une date.

Il figure :

- au pied de page de ce fichier et de `GABARITS.md` ;
- au pied de page de l'index de gouvernance de chaque projet, sous la forme
  **« Conforme à la charte de gouvernance, version {{id}} »** ;
- dans le `PROFIL.md` de chaque projet, comme version sous laquelle le cadrage a été fait.

Une copie dont l'identifiant est inférieur à celui de l'original est une copie périmée, ce
qui se détecte sans lire le contenu.

---

# Partie A — Noyau

Ce qui suit s'applique à tout projet, sans arbitrage. Chaque élément dit ce qu'il impose
et, quand ce n'est pas évident, pourquoi.

## A-1 — Un dossier de gouvernance, versionné avec le code

Chaque dépôt de projet contient à sa racine un dossier **`.AIRules/`** qui porte sa
gouvernance IA, **versionné dans le dépôt du projet lui-même** — pas à part, pas dans un
dépôt séparé. Un `git clone` sur une autre machine récupère ainsi l'intégralité des
pièges, de l'historique et de la roadmap en même temps que le code.

Le nom et l'emplacement ne se négocient pas : c'est ce qui rend une gouvernance
reconnaissable d'un dépôt à l'autre sans avoir à la chercher.

Contenu minimal :

```
.AIRules/
  {{documents de gouvernance}}   (voir A-2 et l'option « documents »)
  PROFIL.md                      (réponses de cadrage — partie C)
  GOUVERNANCE-IA.md              (copie conforme de cette charte — A-7)
  GABARITS.md                    (copie conforme des gabarits — A-7)
  style.css                      (si le projet est au format HTML)
  annexes/                       (à la demande — A-8)
  archive/                       (à la demande — A-9)
```

Si plusieurs projets cohabitent dans un même workspace, l'un peut référencer la
gouvernance d'un autre par lien relatif (`../autre-projet/.AIRules/README.html`) tant que
les deux dossiers restent côte à côte.

## A-2 — Une information a une destination et une seule

Toute connaissance de projet relève de **l'une de trois natures**, et se range en
conséquence — quels que soient le format retenu et le nombre de fichiers :

| Nature | Destination |
|---|---|
| Fait technique stable, invariant, contrainte d'environnement, piège déjà rencontré | **Contexte** |
| Événement daté : commit notable, diagnostic mené, décision actée à une date | **Journal** |
| Ce qui reste à faire, idée non tranchée, décision de périmètre | **Roadmap** |

Trois natures qui n'y sont pas, et qu'il ne faut pas y faire entrer :

- **commandes de build, de test, d'installation** → **fichier d’instructions** (A-11) ;
- **préférence de collaboration, retour d'expérience sur la façon de travailler ensemble**
  → mémoire persistante (A-11) ;
- **information dérivable du code en le lisant, ou périmée** → nulle part. Elle se
  supprime, elle ne se migre pas.

C'est la substance de cette charte. Deux emplacements qui décrivent le même fait
divergeront, et celui qu'on oublie de corriger est celui qu'on relira.

## A-3 — Deux cadences d'écriture opposées

- Le **contexte s'écrit au fil de l'eau, sans rien demander**. Dès qu'un piège technique
  notable est rencontré ou qu'un invariant apparaît, il est consigné immédiatement, avant
  même que le chantier en cours soit terminé. Quand une décision de design change, la
  section périmée se remplace plutôt que de s'empiler.
- Le **journal et la roadmap attendent un feu vert explicite**. Aucun changement de
  statut, aucune décision actée, aucune description de correctif n'y est écrite avant
  confirmation — y compris une mention intermédiaire du type « implémenté, en attente de
  test ». Un build qui passe ou un déploiement réussi ne déclenchent rien.

Le découplage est délibéré : la connaissance la plus périssable — le piège qu'on vient de
rencontrer — est celle qu'on perd en attendant une validation ; le statut d'un chantier,
lui, engage et ne s'écrit pas sans arbitrage.

**Ce que recouvre exactement le feu vert est réglable par projet** (option `seuil`), mais
l'existence des deux cadences ne l'est pas.

**Deux exceptions nommées, et deux seulement :**

1. **La trace de dérive** (A-5) s'écrit sans feu vert. Elle constate un fait — la doc
   disait X, le code fait Y — sans engager aucun statut de chantier.
2. **La session qui s'éternise** : quand une session s'allonge au point que le contexte
   risque d'être perdu (compactage, effacement, interruption), ne pas attendre passivement
   le feu vert. Proposer un point de gouvernance — ce qui a été fait, ce qui reste — et
   n'écrire que ce qui est validé à ce moment-là. L'objectif est de ne pas perdre le
   travail en cours, pas de contourner la validation.

## A-4 — Le journal est en ajout seul

Une entrée de journal écrite **ne se réécrit jamais**, même fausse. Une correction s'ajoute
en tête du chantier concerné, ou sous forme de table de correspondance ; elle ne se
substitue pas.

**Deux exceptions nommées, et deux seulement :**

1. **Remplacer le marqueur `(commit en cours)` par le hash réel.** Elle ne réécrit rien,
   elle complète.
2. **La conversion de format** — faire passer un journal existant d'un support à un autre
   (tableau vers lignes de log, HTML vers Markdown) — sous quatre conditions cumulatives :
   **décidée en révision** (A-13), jamais au fil d'une session ; **appliquée en une fois**,
   à tout le document, jamais entrée par entrée ; à **contenu constant**, le texte de chaque
   entrée transporté tel quel, seul son support changeant ; **vérifiée par comparaison des
   textes extraits** avant et après, la vérification faisant partie du geste et non de la
   bonne volonté. Si les textes extraits diffèrent, ce n'est pas une conversion.

   **Convertir n'est pas réduire.** La conversion est mécanique, scriptable, sans perte —
   c'est elle que cette exception couvre. Ramener des résumés existants à une forme plus
   dense supprime de l'information, autant de fois qu'il y a d'entrées, sans que personne ne
   relise l'ensemble pour vérifier ce qui a sauté : cela reste hors de l'exception. Un format
   plus dense s'applique aux entrées **nouvelles**, et son gain s'installe par accumulation,
   jamais en réécrivant le passé.

Corollaire — une entrée se rédige au moment du commit qu'elle décrit, donc avant que
celui-ci existe. Quand le journal trace des commits, la colonne `Hash` a **trois valeurs, et
trois seulement** :

- le **hash réel**, quand l'entrée décrit un commit déjà fait ;
- **`(commit en cours)`**, pour l'entrée qui part dans le commit qu'elle décrit. Un
  `(commit en cours)` qui survit à plusieurs commits est une anomalie, repérable par un
  simple `grep` ;
- **`n/a` suivi de la raison entre parenthèses**, réservé au travail qui *restera* hors de
  Git : opération système, action sur une autre machine, ressource hors dépôt.

Ne jamais employer une formule comme « non commité » : elle recouvre les deux derniers cas
à la fois, si bien qu'un oubli devient indiscernable d'une valeur légitime.

Un projet dont le journal ne trace pas de commits (voir option `distant`) n'a pas de
colonne `Hash` ; le reste de A-4 s'applique quand même.

## A-5 — Détection de dérive, et sa trace

Si l'état réel du code contredit un invariant documenté — méthode renommée, comportement
différent, statut de chantier faux — **ne pas coder par-dessus l'hypothèse périmée** :
corriger la documentation d'abord, puis continuer. Immédiatement, dans la session où la
dérive est constatée, sans attendre une revue générale.

Toute dérive constatée **laisse une trace** : ce que la doc disait, ce que le code fait,
et ce qui a été corrigé. L'écart entre ce qu'on croyait et ce qui était est lui-même une
information — et une doc qui dérive souvent devient visible.

Cette trace est la première exception nommée d'A-3 : elle s'écrit sans feu vert.

## A-6 — Identifiants stables

Dès qu'un projet numérote ou nomme des ancres (pièges, chantiers, catégories), ces
identifiants sont **attribués une fois et ne bougent plus** — jamais renumérotés, jamais
réattribués, même si l'ordre d'affichage change, même si l'entrée est vidée de sa
substance, même si un archivage libère un numéro.

Motif : ils sont référencés ailleurs — depuis le fichier d’instructions, depuis la roadmap,
depuis un message de commit — et une référence qui pointe silencieusement ailleurs est pire
qu'une référence cassée.

Corollaire : une numérotation stable suppose de connaître le dernier numéro attribué,
information qu'aucune lecture partielle ne donne puisque l'ordre d'affichage ne suit pas la
numérotation. **Chaque document à numérotation stable indique en tête le prochain numéro
libre**, et celui qui ajoute une entrée l'incrémente dans le même geste.

Un projet qui choisit de ne pas numéroter n'est pas concerné par A-6.

## A-7 — La charte voyage avec le projet

`GOUVERNANCE-IA.md` et `GABARITS.md` sont **copiés à l'identique** dans le `.AIRules/` de
chaque projet. L'original canonique vit dans un dépôt public dédié, indépendant de tout
workspace et de toute machine :

```
https://github.com/TooMuhtsh/Claude-Governance.git
```

Motif de la copie locale : un `git clone` doit ramener les règles qui régissent le projet
en même temps que le code, sans dépendre d'un accès réseau ni d'un submodule — qui
romprait cette garantie, un clone sans `--recurse-submodules` laissant `.AIRules/`
incomplet.

- **Copie conforme, jamais adaptée au projet.** Aucune personnalisation, aucun en-tête
  ajouté : les copies doivent rester comparables à l'original par un simple `diff`. Ce qui
  est spécifique à un projet vit dans ses documents et dans son `PROFIL.md`, jamais dans
  sa copie de la charte.
- **À chaque révision, propager les copies dans la foulée**, dans le même mouvement que la
  mise à jour de l'identifiant de version — et les pousser.
- L'identifiant de version suffit à détecter une copie périmée, sans lire le contenu.

### Comment une révision s'applique — deux régimes

- **Révision purement additive** (elle ajoute des options sans toucher au noyau ni changer
  un défaut existant) : elle **se propage d'office**. Rien ne change pour le projet, dont
  le profil hérite des nouveaux défauts ; on signale simplement les questions nouvellement
  ouvertes.
- **Révision qui touche le noyau ou modifie un défaut** : elle **ne s'applique jamais
  d'office**. L'écart se signale, la remise à niveau se propose, en listant ce qui a changé.
  Un projet peut légitimement rester sur une convention antérieure — projet en fin de vie,
  convention volontairement figée, révision non pertinente pour lui.

**Ce qui se propose, c'est la remise à niveau du projet, jamais la copie.** Les deux
fichiers canoniques se propagent d'office dans tous les cas : une copie périmée n'est pas
une convention antérieure assumée, c'est une copie qu'on ne peut plus comparer. Ce qui
attend l'arbitrage, c'est ce que le projet change **de lui-même** — ses documents, son
`PROFIL.md`, la mention de conformité de son pied de page. Une copie à jour posée à côté
d'un projet non remis à niveau est un état normal et lisible : l'écart entre les deux
identifiants *est* le signal.

La table des révisions, en pied de page, dit **de quel régime relève chaque révision** :
sans cette mention, le régime se devine, et il se devine mal.

### `REMISE-A-NIVEAU.md` — un fichier qui meurt à la fusion

Une remise à niveau qui arrive sur une branche — qu'elle vienne d'une veille automatisée
(option `veille-conformité`) ou d'une propagation menée à la main — **n'a pas le droit
d'écrire dans les documents de gouvernance du projet** : ce serait appliquer d'office ce qui
doit se proposer. Sa branche porte donc deux choses de nature opposée : les **copies
conformes**, mises à jour d'office, et **aucune ligne** dans ce qui appartient au projet — ni
son index, ni son contexte, ni son journal, ni sa roadmap, ni son `PROFIL.md`.

Ce qu'impliquent ces copies s'écrit dans un **`REMISE-A-NIVEAU.md`** posé à côté d'elles,
dans `.AIRules/` : révisions traversées, ce que le projet aurait à changer de lui-même,
pièges rencontrés pendant la propagation. Tout se relit donc au moment de la fusion, en un
seul endroit.

**Sa vie s'arrête à la fusion.** Tant que la branche n'est pas fusionnée, il est le seul
endroit où cette information existe, et il est pleinement légitime. Une fois la branche
fusionnée, son seul contenu propre au projet est du **suivi de chantier** : il décrit dès
lors le même fait que le chantier de roadmap qui porte la mise en conformité, et deux
emplacements qui décrivent le même fait divergent (A-2) — typiquement une roadmap qui affiche
la revue comme faite pendant que le fichier liste encore des items ouverts.

Le geste de fusion se termine donc par : **rapatrier son contenu dans le chantier de roadmap,
puis supprimer le fichier**. Un `REMISE-A-NIVEAU.md` présent sur la branche principale est une
anomalie, repérable d'un coup d'œil.

## A-8 — Annexes

Certains contenus ne tiennent pas dans un document principal sans le rendre illisible :
relevé de mesures, tableau de correspondance long, capture d'une configuration de
référence, note de conception détaillée sur un seul chantier, **registre des chantiers de
roadmap arrivés à leur état terminal** quand le projet sépare l'actif du réalisé (option
`registre-livrés`). Ils vont dans un sous-dossier **`annexes/`**, versionné comme le reste.
À ne pas confondre avec l'espace de brouillons, ignoré par Git et jetable (option
`tempfiles`).

`annexes/` ne se crée qu'au moment où un premier fichier annexe existe — pas de dossier
vide « au cas où ». Dès qu'il existe :

- **Aucune annexe orpheline.** Tout fichier d'`annexes/` est atteignable depuis un document
  principal par une **chaîne de liens continue**, à l'endroit où sa lecture devient
  pertinente, chaque page intermédiaire portant le lien de retour vers celle qui la cite.
  Le nombre de sauts est indifférent ; ce qui est interdit, c'est la **rupture** — une page
  qu'on ne peut atteindre qu'en connaissant son chemin. Une annexe qu'aucune page ne cite
  n'est pas une annexe, c'est un fichier oublié.
- **Une annexe complète, elle ne remplace pas.** Le fait, l'invariant ou la décision reste
  énoncé dans le document principal ; l'annexe ne porte que le détail volumineux qui
  l'étaye. Déporter la conclusion elle-même recrée exactement le problème que ce format
  évite.
- Un format libre est acceptable quand il est plus adapté (`.md`, `.json`, `.csv`, capture
  d'écran) : une annexe est une pièce jointe, pas un document de gouvernance de plus.
- **Note d'annexe.** Quand le format ou le poids d'une pièce l'empêche de porter son propre
  lien de retour (binaire, tableur, image, jeu de données volumineux), ou quand la pièce
  vit délibérément **hors du dépôt** (volume qui alourdirait chaque clone, ressource sur
  une autre machine), l'annexe versionnée est une **note Markdown** qui tient ce rôle. Elle
  porte le lien de retour et dit : où la pièce se trouve, pourquoi elle est là plutôt que
  dans le dépôt, comment la régénérer, et **ce qu'on en a appris**. C'est ce dernier point
  qui la justifie : la pièce peut disparaître, la connaissance qu'elle a produite doit lui
  survivre. La note *est* l'annexe ; la pièce n'en est que le support.

## A-9 — Archive

Un document principal qui a beaucoup servi devient long, et sa longueur finit par nuire à
ce pour quoi il existe. Un sous-dossier **`archive/`** permet de le délester **sans rien
perdre**. Dès qu'il existe :

- **Déplacement intégral, jamais réécriture.** Un chantier s'archive en entier — son titre,
  son contexte, son tableau complet — recopié tel quel. Le contenu archivé reste en ajout
  seul : il ne se corrige pas, ne se résume pas, ne se condense pas.
- **Une ligne de renvoi reste en place** dans le document principal, à la position
  chronologique du contenu déplacé : titre du chantier, sa période, et le lien vers
  l'archive. Sans elle, le lecteur ne peut pas savoir que quelque chose a existé — c'est
  précisément ce qui distingue un archivage d'une suppression.
- **Le contenu est intouchable, la navigation ne l'est pas.** Aucun texte archivé ne se
  réécrit ; mais un **lien de navigation** dont la cible a bougé se répare. Trois cas, dans
  cet ordre : la cible existe ailleurs → le lien pointe sa nouvelle position, en chemin
  relatif ; la cible a disparu → le lien devient du texte brut disant ce qu'il désignait et
  qu'il n'existe plus ; **jamais de suppression silencieuse** du renvoi. Un commit qui
  répare des liens d'archive ne touche qu'aux liens, et le dit dans son message.
- **Un archivage attend le feu vert** (A-3) : sortir un chantier du journal *est* une
  écriture dans le journal. La proposition dit quels chantiers partiraient et ce que le
  document principal garderait.
- **Le contexte ne s'archive pas.** Ses ancres sont référencées depuis le fichier
  d’instructions et
  depuis la roadmap : déplacer un piège dans un sous-dossier casse silencieusement chacune
  de ces références. S'y ajoute qu'un piège résolu se conserve en place parce qu'il
  documente pourquoi le code est écrit ainsi. Une catégorie entière peut à la rigueur
  partir si le composant qu'elle décrit a disparu du projet — à condition de vérifier
  d'abord qu'aucune de ses ancres n'est citée ailleurs.
- Une archive ne s'élague pas et ne se supprime pas. Un contenu dont on accepte la perte
  n'avait pas à être archivé — il avait à être supprimé, par une décision explicite, pas
  comme effet de bord d'un rangement.

## A-10 — Ce que la gouvernance publiée doit refléter

**Sur la branche principale, la gouvernance décrit ce qui est sur la branche
principale — jamais un état futur, jamais un travail en cours.** C'est ce qui permet de lui
faire confiance sans vérifier.

- **Committer à chaque mise à jour**, dans la foulée du travail qu'elle décrit. Éviter
  d'accumuler plusieurs chantiers documentés avant de valider.
- Quand un dépôt distant existe (option `distant`), **pousser dans le même mouvement**.
  Une gouvernance à jour qui dort en local n'est ni sauvegardée, ni récupérable depuis une
  autre machine, ni exploitable par un outil externe qui lit le dépôt.

## A-11 — Fichier d'instructions et mémoire persistante

Chaque projet garde à sa racine un **fichier d'instructions auto-chargé par l'assistant**,
qui sert de **référence rapide** : commandes de build et de test, particularités
d'installation, et une consigne explicite de lire la gouvernance en début de session avant
tout le reste. Il ne duplique pas le contenu détaillé de `.AIRules/` — seulement des
pointeurs.

Son nom dépend de l'outil qui le consomme et se déclare au cadrage (option
`fichier-instructions`) : `CLAUDE.md`, `AGENTS.md`, ou les deux. La charte ne le nomme nulle
part ailleurs, parce qu'elle ne dépend d'aucun outil.

### Sa mise à jour est un point de passage, pas une réaction

**Toute écriture dans la gouvernance vérifie d'abord le fichier d'instructions**, et le
corrige si nécessaire, avant d'être considérée comme terminée. « Si nécessaire » reste du
jugement ; la **vérification**, elle, ne l'est plus.

C'est la différence entre une règle tenue et une règle oubliée : « mettre à jour dès qu'une
commande change » suppose de remarquer le changement, ce qui n'arrive pas. Un point de
passage arrive à chaque fois.

Ce qui se vérifie, au minimum : commandes de build, de test et d'installation ; particularité
d'installation ou d'environnement ; renvois vers la gouvernance et vers les identifiants
qu'elle porte ; mot de clôture et mot de cadrage (options `mot-cloture`, `mot-cadrage`) ;
décision d'attribution (option `attribution`).

Si plusieurs projets cohabitent dans un workspace, un fichier d'instructions à sa racine
référence chacun d'eux et pointe vers sa gouvernance.

### Mémoire persistante

- La **mémoire persistante inter-conversations** est complémentaire, pas redondante :
  `.AIRules/` et le fichier d'instructions portent ce qui est **spécifique au projet et
  versionné avec le code** ; la mémoire porte ce qui est **transverse et propre à la
  collaboration**
  (préférences, retours d'expérience sur la façon de travailler, état d'avancement à
  connaître avant même d'ouvrir un projet, pointeurs vers des systèmes externes).
- Une information dérivable du code ou déjà documentée dans `.AIRules/` n'a pas sa place en
  mémoire ; inversement, un retour d'expérience sur la manière de collaborer ne doit pas
  finir enterré dans un document de projet où il ne sera relu que pour ce projet.
- **Point mémoire de fin de session** : avant tout effacement de contexte, faire un bilan
  explicite — ce qui a été appris sur la façon de collaborer, ce qui a changé dans l'état
  d'avancement, ce qui s'est révélé faux dans une mémoire existante. Une mémoire contredite
  par un retour plus récent **se réécrit ou se supprime** ; elle ne cohabite pas avec la
  version périmée.

## A-12 — Discipline de vérification

Ces règles ne sont spécifiques à aucune technologie et s'appliquent à toute session de
travail.

- **Ne jamais conclure sur une seule source quand une seconde est accessible.** Pour savoir
  si un composant d'une dépendance externe est réellement utilisable, la documentation ou
  les typings ne suffisent pas : confronter la source déclarative **et** le comportement
  réel à l'exécution. Un champ ou une signature peut différer entre les deux. Le principe
  dépasse les API : schéma contre données réelles, configuration déclarée contre
  configuration effective, documentation d'un outil contre sortie observée.

- **Validation en conditions réelles avant « fait ».** Ne jamais marquer une fonctionnalité
  comme terminée avant confirmation explicite qu'elle fonctionne. Cette règle ne porte pas
  seulement sur le statut final : tant que la validation n'est pas venue, le chantier ne
  reçoit **aucune écriture** dans le journal ou la roadmap, pas même une ligne d'état
  intermédiaire. Un build qui passe, un déploiement réussi ou une relecture de code ne
  valent pas validation. **Ce que « conditions réelles » veut dire sur un projet donné se
  définit au cadrage** (option `validation`) : sans définition écrite, la question se
  rediscute à chaque chantier.

- **Données jetables pour tout test destructif.** Toute manipulation touchant des données
  réelles ou de production se teste d'abord sur des entrées jetables clairement
  identifiables, jamais directement sur les vraies données — même quand le risque semble
  faible. **La convention de nommage jetable se définit au cadrage** (option `jetables`) :
  une convention générique n'est jamais reprise telle quelle.

- **Sauvegarder puis `diff` avant de conclure.** Toute modification scriptée d'un fichier
  que l'utilisateur possède (configuration, données) se fait après copie de sauvegarde et
  se termine par un **`diff` intégral** contre cette sauvegarde — pas par une relecture de
  la partie qu'on croit avoir touchée. Certains dégâts sont totalement silencieux et hors
  de la zone éditée.

- **Un outil qui réécrit un fichier peut en altérer silencieusement l'encodage.** Certaines
  chaînes lecture-écriture ne font pas un aller-retour propre sur les caractères non-ASCII,
  ré-encodent à chaque cycle et ajoutent des marqueurs invisibles. Préférer un outil dont
  l'aller-retour est garanti pour le contenu, réserver les autres au pilotage de processus,
  et vérifier par `diff` intégral. Le cas précis rencontré sur une plateforme donnée est un
  piège de projet : il se documente dans le contexte du projet, pas ici.

- **Ne pas trancher un compromis sûreté/complétude à la place de l'utilisateur.** Quand une
  variante partielle mais sans risque s'oppose à une variante complète mais susceptible
  d'endommager des données ou un état existant, ne pas supposer que la plus complète est
  attendue : exposer les deux, dire laquelle est recommandée et pourquoi, laisser le choix.

- **Chercher une bibliothèque établie avant d'écrire un utilitaire maison.** Pour tout
  besoin d'outillage qui paraît simple (assainissement d'entrées, échappement, parsing,
  formats de date, jeux de données de référence, icônes), vérifier d'abord s'il existe une
  bibliothèque ou un jeu de données reconnu et maintenu, et le proposer — le code maison
  sur ces sujets est un nid de failles et de cas limites oubliés. Ne partir sur une
  implémentation propre qu'après avoir constaté, **et dit explicitement**, qu'aucune option
  établie ne couvre le besoin. La règle impose la recherche, pas la dépendance : un projet
  peut déclarer une politique de dépendances minimales (option `dépendances`), qui fait
  pencher l'arbitrage sans dispenser de chercher.

## A-13 — Un changement structurant se propose, il ne s'applique pas

Tout changement structurant — refonte d'un document de gouvernance, choix d'architecture,
changement de convention, modification du `PROFIL.md` — se présente sous forme de
**propositions numérotées et individuellement validables**, avec pour chacune le texte ou
le comportement exact qui en résulterait. Pas sous forme de modification déjà appliquée
qu'il faudrait relire pour la contester. L'utilisateur valide par numéros ; seules les
propositions retenues sont écrites.

En dessous de ce seuil, une modification ordinaire s'applique directement — la cérémonie
n'a de valeur que là où la décision en a une.

## A-14 — Écrire dans un document de gouvernance

- **Modification ciblée, jamais réécriture complète** d'un document existant pour un ajout
  localisé : patcher le bloc concerné, pas régénérer le fichier. Le risque de casser une
  structure augmente avec la taille du document, et un copier-coller suffit à faire sauter
  tout un rendu sans qu'aucune erreur ne le signale.
- **Valider la syntaxe après toute modification d'un document qui dépasse une taille
  triviale**, avant de considérer la modification terminée. L'outil se choisit au cadrage
  (option `validateur`) et sa commande exacte vit dans le fichier d’instructions.
- **Tous les liens internes sont relatifs**, avec autant de `../` que la profondeur réelle
  l'exige. Jamais de chemin absolu, jamais de chemin de machine, jamais de `/` initial :
  `.AIRules/` doit s'ouvrir tel quel après un `git clone` sur n'importe quelle machine, et
  un lien en dur y casse silencieusement. Corollaire : déplacer une page dans un
  sous-dossier impose de recalculer ses liens.
- **Trois niveaux d'encadré, et trois seulement** — leur sémantique est identique d'un
  projet à l'autre :

  | Niveau | Sens | Exemple |
  |---|---|---|
  | `note` | Information neutre, légende, précision qui aide à lire la suite. | Expliquer une convention en tête de document. |
  | `warning` | Piège opérationnel actif — quelque chose qui *peut se reproduire*. | « Telle action supprime silencieusement tel fichier. » |
  | `important` | Décision actée, règle non négociable, ou risque élevé. | Décision de sortir un chantier du périmètre, garde-fou sur une donnée sensible. |

- **L'ossature d'un document est imposée, sa rédaction ne l'est pas.** `GABARITS.md`
  distingue explicitement les deux : ce qui porte la structure (sommaire, catégories,
  tableau de vue d'ensemble, protocole d'entrée, ordre des sections) est obligatoire ; le
  détail de rédaction et les catégories proposées sont indicatifs.

## A-15 — Transposer ou remettre à niveau une gouvernance existante

Deux situations, à ne pas traiter de la même façon.

### Cas A — transposer un existant vers le format `.AIRules/`

Un projet en cours a rarement une page blanche : un fichier d’instructions qui a gonflé, un
`README`
fourre-tout, notes Markdown, `docs/`, wiki, tickets, `TODO` en commentaire, historique Git.
La migration **redistribue** cet existant, elle ne le réécrit pas de zéro et ne le recopie
pas tel quel.

1. **Inventorier les sources avant de créer quoi que ce soit.** On ne migre bien que ce
   qu'on a vu.
2. **Trier par nature d'information, pas par fichier d'origine** — la table d'A-2 est le
   critère. La ligne la plus importante est la dernière : ce qui est dérivable du code ou
   périmé se supprime. Une migration réussie *réduit* le volume de doc.
3. **Vérifier avant d'inscrire, ne jamais recopier de confiance.** Une doc existante est
   souvent périmée sans que personne ne l'ait remarqué. Ce qui n'a pas pu être vérifié
   n'est pas jeté pour autant : il est inscrit avec une marque explicite « repris de
   l'ancienne doc, non revérifié » — visible, donc corrigeable.
4. **Reconstruire l'historique sans y passer la semaine** : depuis `git log`, mais **par
   chantier, pas commit par commit**. Tout ce qui précède la gouvernance peut tenir en un
   seul chantier `Avant la gouvernance ({{période}})`. L'exhaustivité rétroactive n'a
   aucune valeur ; la reprise du fil en a une.
5. **Geler la numérotation à la migration**, dans l'ordre où on rencontre les pièges (A-6).
   Ne pas chercher à la faire correspondre à un ordre chronologique.
6. **Ordre recommandé** : contexte d'abord (valeur immédiate), puis roadmap, puis index, et
   journal en dernier — le plus coûteux et le moins urgent. Une gouvernance partielle mais
   juste vaut mieux qu'une migration complète repoussée.
7. **Élaguer les sources d'origine**, en y laissant un pointeur d'une ligne. Puis faire
   valider : une transposition est une proposition (A-13).

### Cas B — remettre à niveau un `.AIRules/` qui a dérivé

Une gouvernance au bon format n'est pas pour autant juste. C'est un **audit document par
document**, pas une réécriture.

**Quand la déclencher** — plutôt qu'une périodicité qu'on ne tient jamais, des déclencheurs :

- **reprise après une longue interruption** — le cas le plus courant et le plus dangereux :
  la doc paraît fiable justement parce qu'elle n'a pas bougé ;
- **montée de version majeure d'une dépendance centrale** — rejouer en priorité les pièges
  marqués comme dépendant d'un comportement non contractuel ;
- **arrivée d'un nouveau contributeur, humain ou assistant** — la première lecture
  extérieure est le meilleur détecteur de contenu périmé ;
- **révision de la charte** touchant le noyau ou un défaut (A-7) ;
- **dérive constatée en session ordinaire** — dans ce cas, corriger immédiatement le point
  constaté (A-5), quitte à planifier la revue complète séparément.

**Que vérifier :**

- **Contexte** — confronter chaque invariant au code réel. Un piège **résolu depuis
  longtemps se conserve** : il documente pourquoi le code est écrit ainsi, et le supprimer
  invite à refaire l'erreur. Un piège devenu **faux** se corrige en place, en disant ce qui
  a changé et depuis quand — jamais de suppression silencieuse. Les identifiants ne bougent
  pas (A-6).
- **Roadmap** — confronter chaque statut à l'état réel du dépôt. Un chantier marqué livré
  dont on ne trouve **ni trace de validation, ni trace de mise en service** redescend : « le
  code est là » n'a jamais valu « c'est livré ». Un chantier planifié dont le design ne
  convainc plus rejoint « hors périmètre » **avec l'encadré qui dit pourquoi** — sans quoi
  il sera reproposé six mois plus tard.
- **Journal** — ne rien corriger rétroactivement (A-4). Ajouter une entrée datée qui
  **acte la revue et les écarts constatés**.
- **Index** — vérifier que le protocole de démarrage décrit toujours la réalité du projet,
  et que sa version de conformité à la charte est à jour.
- **`PROFIL.md`** — reposer les questions marquées « non tranché », et celles dont la
  réponse ne correspond plus à ce qu'est devenu le projet.

Une remise à niveau se termine par la **mise à jour effective des dates de dernière revue**.
Une date qui ne bouge pas signifie que la revue n'a pas eu lieu — c'est le seul signal dont
dispose le lecteur suivant.

---

# Partie B — Options

Chaque option se décide par projet et sa réponse s'écrit dans `PROFIL.md` (partie C).
Chaque défaut porte son motif : un défaut sans motif ne se conteste pas, il se subit.

| Clé | Question | Valeurs | Défaut |
|---|---|---|---|
| `format` | Format des documents | `html` · `markdown` · autre | `html` |
| `documents` | Nombre de documents | `4` · `3` (journal et roadmap fusionnés) | `4` |
| `registre-livrés` | Séparer la roadmap active du registre des chantiers livrés | `oui` · `non` | `oui` |
| `journal-format` | Format des entrées du journal | `tableau` · `log` | `tableau` |
| `fichier-instructions` | Nom du fichier d'instructions auto-chargé | `CLAUDE.md` · `AGENTS.md` · les deux · autre | `CLAUDE.md` |
| `statuts` | Vocabulaire de statuts | `complet` · `réduit` | `complet` |
| `outillage` | Le projet produit-il de l'outillage pour vous-même ? | `oui` · `non` | déduit au cadrage |
| `tempfiles` | Espace de brouillons hors Git | `oui` · `non` | `oui` |
| `distant` | Dépôt distant | `oui` · `local-seul` | `oui` |
| `visibilité` | Dépôt public ou privé | `public` · `privé` | **sans défaut** |
| `attribution` | Métadonnées d'attribution IA dans les commits | `oui` · `non` | **sans défaut** |
| `authentification` | Compte et méthode d'authentification pour la forge | texte libre | **sans défaut** |
| `branches` | Où vit un chantier non abouti | `branche` · `direct` | `branche` |
| `seuil` | Ce que recouvre le feu vert d'A-3 | `strict` · `roadmap-libre` · `tout-libre` | `strict` |
| `roadmap-avant-code` | Une idée passe-t-elle par la roadmap avant le code ? | `oui` · `non` | `oui` |
| `mot-cloture` | Mot qui déclenche la chaîne de clôture complète | texte libre · `aucun` | **sans défaut** |
| `mot-cadrage` | Mot qui relance l'entretien de cadrage | texte libre · `aucun` | **sans défaut** |
| `validation` | Ce que « conditions réelles » veut dire ici | texte libre | **sans défaut** |
| `jetables` | Convention de nommage des données de test | texte libre · `sans objet` | **sans défaut** |
| `test-manuel` | Test manuel d'abord, automatisation en dernier recours | `oui` · `non` | `oui` |
| `support-test` | À partir de combien de vérifications une passe se déroule sur un document dédié | nombre · `prose` · `fichier` | `8` |
| `dépendances` | Politique de dépendances | `ordinaire` · `minimales` | `ordinaire` |
| `discipline-test` | Comment teste-t-on, et qu'est-ce qui ne doit jamais être touché en test | texte libre | **sans défaut** |
| `validateur` | Outil de validation de syntaxe des documents | texte libre | **sans défaut** |
| `veille-conformité` | Vérification périodique automatisée de la conformité | `oui` · `non` | `non` |

## `format` — format des documents

**`html`** (défaut) : fichiers HTML statiques ouverts directement dans un navigateur, pas de
serveur, pas de build, pas de JavaScript, feuille de style partagée. **`markdown`** : même
structure, rendu par la forge ou par un éditeur. Un **autre format** peut être ajouté à la
demande, à condition de fournir son gabarit équivalent dans `GABARITS.md` : une seule
structure, plusieurs rendus.

*Pourquoi `html` par défaut* : les statuts et les encadrés portent une part réelle de
l'information, et le HTML les rend sans dépendre d'un moteur de rendu tiers — un document
ouvert depuis le disque, hors ligne, après un clone, est lu exactement comme prévu.

Quel que soit le format, la structure est la même et se convertit sans perte
(`GABARITS.md`, table de conversion).

## `documents` — nombre de documents

**`4`** (défaut) : index, contexte, journal, roadmap. **`3`** : journal et roadmap
fusionnés en un document unique.

*Pourquoi `4`* : quatre documents rendent la destination d'une information évidente sans
réfléchir, et c'est la lecture qui coûte, pas le nombre de fichiers.

**Critère de scission, obligatoire si `3` est retenu** : dès que le document fusionné
dépasse ce qu'on relit d'un bout à l'autre, il se sépare. Sans ce critère écrit, la fusion
devient définitive par inertie.

## `registre-livrés` — séparer la roadmap active du registre des chantiers livrés

**`oui`** (défaut) : un chantier arrivé à son **état terminal** (`Livré`, ou `Adopté` pour
l'outillage) quitte la roadmap active pour un **registre du réalisé** —
`annexes/REALISE.{{ext}}` au sens d'A-8, jamais `archive/` (A-9), dont le régime d'ajout
seul interdirait à la fois la condensation à l'entrée et l'amendement d'un chantier livré.
La roadmap active n'en garde qu'**une ligne et le lien** vers son entrée du registre ;
l'énoncé et le détail complet y vivent en entier, pas en double (A-2).

*Pourquoi `oui` par défaut* : mesuré le 2026-08-03 sur un projet réel, 87 % des pastilles de
statut d'une roadmap marquaient un chantier déjà livré — le document censé porter « ce qui
reste à faire » décrivait surtout ce qui était fait, jusqu'à devenir le plus lourd document
de la gouvernance. Rien n'empêchait ce découpage avant cette option : la roadmap n'est pas
en ajout seul (A-15 l'exige même de la corriger en place) ; il manquait seulement une
convention nommée, pas une exception à créer.

**`non`** : la roadmap reste un document unique, faits compris — adapté à un projet dont
l'historique de chantiers reste court.

**Ce que porte une entrée du registre**, dans cet ordre :

1. Le design retenu et l'ampleur du chantier, repris depuis la roadmap au moment de la
   bascule — pas réécrit.
2. Le renvoi vers l'entrée de journal qui l'a acté : le journal garde l'événement daté, le
   registre garde l'état.
3. Les évolutions post-livraison, **une ligne chacune** — ajout, retrait ou remplacement —
   datée par rapport à la livraison initiale. Une ligne se limite au changement lui-même ;
   le récit du pourquoi et du comment reste au journal, que la ligne renvoie sans le
   répéter. Le seuil qui décide si une évolution reste une ligne ou rouvre un chantier dans
   l'actif est celui de l'option `roadmap-avant-code` : dès qu'elle touche l'architecture,
   une convention, ou plus d'un fichier.
4. Les numéros de pièges issus du chantier, **sans les réexpliquer** — le contexte les
   décrit (A-2), le registre fournit le renvoi inverse, du chantier vers le piège.
5. La liste des commits du chantier, sur une seule ligne, en ordre chronologique — la seule
   information de l'entrée qu'aucun autre document ne porte.

**Une réécriture d'historique invalide cette ligne de commits, en silence** : `rebase`,
`filter-branch` ou une amende massive changent les hashes sans que la ligne cesse d'être
lisible. Elle impose alors de rejouer la ligne, ou d'y porter une table de correspondance —
le même geste qu'A-4 prévoit pour le journal.

**Ordre du registre** : le plus récent en tête, un nouveau chantier s'ajoute en début de
fichier — l'inverse de l'ordre de la roadmap active. **Un chantier `Écarté` n'y bascule
jamais** : il reste en « Hors périmètre » dans la roadmap active, seul endroit qui évite
qu'une idée déjà tranchée soit reproposée six mois plus tard.

**Indépendant de l'option `documents`** : que la roadmap et le journal restent scindés en
quatre documents ou fusionnés en trois, le registre est une **annexe**, pas un cinquième
document principal — il ne compte pas dans ce total et n'entre jamais dans la navbar
(`GABARITS.md`, § 5).

## `journal-format` — format des entrées du journal

**`tableau`** (défaut) : une section par chantier, chacune avec son propre tableau
`Date | Hash | Résumé` (`GABARITS.md`, § 3). **`log`** : un tableau unique et plat pour tout
le journal, trié de la plus récente à la plus ancienne entrée, colonnes
`Date | Hash | Chantier | Résumé` — `Chantier` devient un champ de chaque ligne plutôt qu'un
regroupement en section.

*Pourquoi `tableau` par défaut* : c'est la structure historique de la charte, et rien
n'oblige un projet jeune ou à faible volume à basculer — le coût du format `log` se paie en
discipline d'écriture (borne de caractères, renvois raccourcis), pas en simplicité de
lecture.

**Ce que change `log`** :

- **`Résumé` borné à 250 caractères.** Se vérifie d'un `grep` sur la longueur de la cellule.
  Un résumé qui dépasserait se réduit au fait acté, pas au récit qui y a mené.
- **Le paragraphe de contexte de chantier n'a plus de place dans le journal.** Ce qu'il
  portait — le pourquoi d'un chantier, qui l'a signalé, ce qui l'a déclenché — devient, s'il
  compte encore, un **fait stable dans le contexte** (`AI-CONTEXT`) plutôt qu'un événement
  daté : A-2 le range là dès qu'il cesse d'être ponctuel.
- **Les liens d'ancre survivent, sous forme courte**, insérés dans le texte du résumé —
  `[#N]` vers un piège du contexte, `[roadmap#slug]` vers un chantier de la roadmap —
  comptés dans les 250 caractères comme le reste.
- **Convertir un journal existant** du format `tableau` vers `log` est permis par la
  deuxième exception nommée d'A-4 (conversion de format, à contenu constant, vérifiée) —
  ce n'est jamais une obligation : un journal peut rester au format `tableau` indéfiniment,
  y compris sur un projet qui adopte `log` pour ses entrées futures.

Régime de cette option : purement additive — nouvelle option, aucun défaut existant ne
change, un projet qui ne répond pas hérite de `tableau` sans rien changer à son journal.

## `fichier-instructions` — nom du fichier d'instructions

**`CLAUDE.md`** (défaut) · **`AGENTS.md`** · **les deux** · **autre**.

*Pourquoi `CLAUDE.md` par défaut* : c'est le fichier de l'outil qui consomme cette charte
aujourd'hui. Le défaut nomme un usage, il ne prescrit pas un produit — A-11 ne mentionne
aucun nom.

Si **les deux** sont retenus, l'un est la **source** et l'autre un **renvoi d'une ligne**
vers lui. Jamais deux contenus à tenir en parallèle : ce serait exactement la double source
de vérité qu'A-2 interdit, à l'endroit le plus lu du dépôt.

## `mot-cloture` — le mot qui ferme un chantier

**Sans défaut**, texte libre, ou `aucun` si le projet n'en veut pas.

Un mot — ou une phrase courte — dont l'énoncé vaut, **en un seul geste** :

1. le **feu vert explicite** qu'A-3 exige avant toute écriture dans le journal et la
   roadmap ;
2. la mise à jour des documents de gouvernance concernés ;
3. la vérification du fichier d'instructions (A-11) ;
4. le commit ;
5. le push, si le projet a un dépôt distant (option `distant`).

**Ce n'est pas un contournement de la validation, c'en est la forme la plus courte.**
Prononcer le mot *est* le feu vert : la charte n'a jamais exigé une cérémonie, seulement une
décision explicite de l'utilisateur. Un raccourci qui porte cette décision la respecte
pleinement.

*Pourquoi sans défaut* : un mot imposé n'est pas le vôtre, et un mot qu'on n'a pas choisi ne
se retient pas. Deux contraintes seulement — qu'il soit **distinctif** (il ne doit pas se
déclencher au fil d'une phrase ordinaire) et qu'il soit **rappelé dans le fichier
d'instructions**, sans quoi il n'est connu que de celui qui l'a écrit.

La chaîne s'arrête à la première étape qui échoue, et dit où elle s'est arrêtée. Un mot de
clôture qui laisse croire à un push qui n'a pas eu lieu est pire que pas de mot du tout.

## `mot-cadrage` — le mot qui relance l'entretien

**Sans défaut**, texte libre, ou `aucun`.

Son énoncé rouvre l'entretien de cadrage (partie C) sur un projet déjà cadré : soit en
entier, soit sur quelques clés nommées. Chaque changement retenu suit A-13 — proposition,
validation, ligne au journal.

*Pourquoi sans défaut, et pourquoi un mot distinct de `mot-cloture`* : ce sont deux gestes de
fréquence très différente. Clôturer arrive à chaque chantier ; recadrer arrive quand le
projet change de nature. Les fondre dans un seul mot ferait payer au geste fréquent une
question intermédiaire à chaque fois.

## `statuts` — vocabulaire de statuts

**`complet`** (défaut), six états :

| État | Sens |
|---|---|
| **Livré** | Chantier **validé en conditions réelles** *et* **effectivement en service** : déployé, publié et installé, ou fusionné sur la branche principale selon la nature du projet. Un code validé qui dort sur une branche n'est pas livré. |
| **Adopté** | Réservé aux chantiers d'**outillage et de convention** : l'outil est livré *et* son **usage est constaté dans le flux de travail réel**. Une démonstration réussie ne suffit pas. Pour une fonctionnalité livrée à des utilisateurs, « Livré » reste l'état terminal — ne pas attendre un second feu vert qui ne viendra jamais. Présent seulement si `outillage = oui`. |
| **En cours** | Développement actif. |
| **Prévu** | Design discuté et au moins partiellement tranché, pas encore codé. Nuancer le libellé selon l'avancement (« Proposé », « Mécanisme tranché », « Design validé »). |
| **Écarté** | Explicitement sorti du périmètre — toujours accompagné d'un encadré `important` expliquant pourquoi. |
| **À revérifier** | Marque un piège qui dépend d'un comportement non contractuel d'une dépendance externe — à rejouer après une mise à jour de celle-ci. |

**`réduit`** : les quatre premiers hors « Adopté » — Livré, En cours, Prévu, Écarté. C'est
un **sous-ensemble strict**, jamais un vocabulaire différent : un projet qui grandit ajoute
les manquants sans rien renommer.

*Pourquoi `complet`* : « Adopté » et « À revérifier » portent deux distinctions qu'un audit
a coûté cher à établir — l'outil qui marche contre l'outil qu'on utilise, et le piège
stable contre le piège suspendu à une dépendance. Un projet qui ne les utilise pas ne les
écrit simplement jamais.

**Corollaire de « Adopté »** : un outillage resté « Livré » sans usage constaté est un
signal. Soit il est adopté, soit on acte qu'il ne sert pas — en le sortant du périmètre
avec l'encadré qui dit pourquoi, plutôt qu'en le laissant afficher un statut littéralement
vrai et pratiquement faux.

## `outillage` — le projet produit-il de l'outillage pour vous-même ?

Script, commande, workflow, tracker, convention d'écriture. Détermine si l'état « Adopté »
existe sur ce projet.

*Pourquoi pas de défaut fixe* : la question se pose factuellement au cadrage plutôt que
d'imposer un état inatteignable ou d'exclure une distinction utile.

## `tempfiles` — espace de brouillons hors Git

**`oui`** (défaut) : un dossier `.tempfiles/`, **ignoré par Git**, pour les notes de brief,
brouillons et fichiers d'échange ponctuels.

*Pourquoi `oui`* : le besoin existe sur tout projet, et le nommer d'avance évite que des
brouillons finissent versionnés par accident ou éparpillés dans le système de fichiers.

Dès qu'il existe, ses règles sont invariantes :

- Ces fichiers sont **jetables par construction** : une fois **entièrement** exploités
  ailleurs (code, gouvernance, mémoire), ils se suppriment directement, sans demander
  confirmation et sans les laisser traîner.
- **« Exploité » signifie que plus rien d'actionnable n'y reste.** Une extraction
  partielle — quelques lignes reprises d'un brouillon qui en contient plusieurs — ne
  l'épuise pas. Un fichier de notes en vrac dont une seule idée a servi n'est pas jetable
  tant que le reste n'a pas été traité ou explicitement abandonné.
- Dans le doute sur l'épuisement réel d'un fichier, **redemander plutôt que supprimer**.
- **Jamais un fichier de code ou de configuration**, quel que soit son état.

## `distant` — dépôt distant

**`oui`** (défaut) : la gouvernance se pousse à chaque mise à jour (A-10). **`local-seul`** :
elle se commite seulement.

*Pourquoi `oui`* : une gouvernance qui ne survit pas à la machine n'est pas une garantie,
c'est un fichier.

Si `local-seul` est retenu, ce qui est perdu doit être écrit dans le `PROFIL.md` : pas de
sauvegarde, pas de récupération depuis une autre machine, pas d'exploitation par un outil
externe. L'absence de distant devient un **état déclaré**, pas un oubli.

## `visibilité` — dépôt public ou privé

**Sans défaut** : à trancher avant le premier commit, jamais après. Rendre public plus tard
un dépôt écrit comme privé oblige à réécrire l'historique ; l'inverse ne coûte rien.

**Sur un dépôt public, ce qui reste dehors :**

- chemins de machine et arborescences locales ;
- noms d'hôtes, adresses IP, noms de serveurs, identifiants de comptes ;
- jetons, mots de passe, clés — sous toute forme, y compris dans un exemple ;
- captures de configuration personnelle et scripts de poste de travail ;
- récits d'incident nominatifs ou datés qui exposent une session de travail ;
- tout ce qui décrit la façon de travailler d'une personne plutôt que la façon de
  fonctionner du projet.

La règle vaut pour la documentation comme pour le code et les messages de commit. Le
jugement au cas par cas s'applique bien au premier commit et beaucoup moins au
deux-centième : la liste existe pour ça.

## `attribution` — métadonnées d'attribution IA dans les commits

Co-auteur, lien de session, mention de l'outil. **Sans défaut** : sur un dépôt public, ces
métadonnées exposent un historique de collaboration qui n'était pas forcément destiné à
être publié. C'est une décision d'auteur, pas un réglage d'outil — elle se pose toujours.

La réponse s'écrit dans `PROFIL.md`, et le fichier d’instructions porte un renvoi d'une
ligne pour
qu'elle n'ait pas à être rediscutée à chaque commit.

## `authentification` — accès à la forge

Quel compte, quelle méthode. **Sans défaut** : plusieurs comptes peuvent cohabiter sur une
machine, et toute la synchronisation ultérieure (création du dépôt, push, demandes de
fusion) en dépend. Se pose au cadrage, pas au premier push quand un échec
d'authentification tombe au milieu d'autre chose.

Mise en œuvre : vérifier l'état existant ; si une connexion est nécessaire, **c'est
l'utilisateur qui l'exécute** — session interactive avec saisie de secret. Ne jamais
demander un jeton en clair ni l'écrire dans un fichier du dépôt.

## `branches` — où vit un chantier non abouti

**`branche`** (défaut) : tant qu'un chantier n'est pas abouti, sa documentation
l'accompagne sur sa branche et arrive sur la principale avec lui, dans le même merge.
**`direct`** : le projet travaille sur la branche principale et n'écrit qu'après coup.

*Pourquoi `branche`* : c'est le seul moyen mécanique de garantir A-10 — la principale ne
décrit jamais du code absent. `direct` respecte le même invariant autrement, par
discipline d'écriture, sans imposer un modèle de branches à un projet qui n'en veut pas.

## `seuil` — ce que recouvre le feu vert

| Valeur | Effet |
|---|---|
| **`strict`** (défaut) | Seul le contexte s'écrit librement. Journal et roadmap attendent le feu vert. |
| `roadmap-libre` | La roadmap s'écrit aussi librement — consigner une idée n'engage rien. Le journal reste sous validation. |
| `tout-libre` | Tout s'écrit librement. Réservé aux prototypes et aux projets solo sans enjeu de statut. |

*Pourquoi `strict`* : c'est la règle qui empêche une roadmap de mentir, et un statut écrit
sans arbitrage est un statut que personne n'a décidé.

## `roadmap-avant-code` — une idée passe-t-elle par la roadmap avant le code ?

**`oui`** (défaut) : quand une idée est exprimée en vrac — a fortiori plusieurs d'un coup —
le réflexe par défaut n'est pas de coder, mais de la consigner dans la roadmap avec son
design étudié, puis d'attendre l'arbitrage. L'implémentation ne démarre que sur consigne
explicite.

**Seuil de déclenchement** : une idée passe par la roadmap dès qu'elle touche
l'architecture, une convention, ou plus d'un fichier. En deçà, on peut coder directement —
ouvrir une entrée de roadmap pour renommer une variable ne protège personne.

*Pourquoi `oui`* : c'est ce qui empêche une remarque en passant de devenir trois heures
d'implémentation non demandée.

## `validation` — ce que « conditions réelles » veut dire ici

**Sans défaut**, texte libre : test manuel dans l'application hôte, scénario de recette,
retour d'un utilisateur tiers, suite d'intégration verte sur un environnement représentatif.

*Pourquoi sans défaut* : A-12 impose la validation mais ne peut pas savoir ce qu'elle
signifie ici. Sans définition écrite, elle se rediscute à chaque chantier — et finit par
s'éroder.

## `jetables` — convention de nommage des données de test

**Sans défaut**, texte libre (`grp-zzz-test-*`, `sandbox-*`, base dédiée…), ou `sans objet`
si le projet ne touche aucune donnée réelle.

*Pourquoi sans défaut* : une convention générique n'est jamais reprise telle quelle, parce
qu'elle ignore les contraintes de nommage du système hôte. Une convention écrite est une
convention qu'on peut vérifier d'un coup d'œil.

Si `sans objet` est retenu, la réponse se repose à chaque remise à niveau : « ce projet ne
touche pas de données réelles » est une affirmation qui vieillit mal.

## `test-manuel` — test manuel d'abord

**`oui`** (défaut) : quand une vérification tient en quelques clics ou saisies dans une
interface que l'utilisateur a sous la main, lui fournir une **checklist de test manuel
précise** (quoi faire, quel résultat attendre, comment vérifier la persistance) et rester
en **écoute passive** sur les traces (logs, fichiers de configuration, sorties de
processus). Une fois qu'il a demandé à piloter l'application lui-même, ne plus simuler ses
actions.

*Pourquoi `oui`* : écrire un script d'automatisation d'interface pour un geste ponctuel
coûte largement plus cher que le geste, et l'utilisateur préfère généralement le faire.

**Trois cas d'escalade vers un banc de mesure automatisé** — pilotage de l'application,
instrumentation temporaire, capture d'état :

1. deux ou trois hypothèses successives ont déjà été invalidées manuellement sans que la
   cause n'apparaisse — arrêter alors de proposer des correctifs à l'aveugle ;
2. le volume de vérifications dépasse ce qu'un humain fera raisonnablement ;
3. l'utilisateur le demande explicitement.

Dans ces cas l'investissement est décisif : il révèle les bugs à causes multiples, qu'une
série de correctifs partiels ne peut par construction jamais valider.

## `support-test` — sur quel support se mène une passe

Une passe de vérifications manuelles peut s'énoncer **dans le fil de la conversation**, ou
se dérouler sur un **document autonome** que l'utilisateur remplit à mesure et dont il
renvoie un rapport en un geste.

| Valeur | Effet |
|---|---|
| **un nombre** (défaut : `8`) | Seuil indicatif : au-delà de tant de vérifications, le document se propose. |
| `prose` | Toujours dans le fil, quelle que soit la longueur. |
| `fichier` | Toujours un document, même pour trois vérifications. |

*Pourquoi un seuil plutôt qu'un choix binaire* : le point de bascule dépend du projet et
de la nature des tests — six vérifications longues et fragiles pèsent plus que douze
gestes triviaux. Le seuil se fixe au cadrage pour ne pas se rediscuter à chaque chantier,
mais **l'arbitrage autour de lui reste au jugement** : c'est une valeur de référence, pas
une règle de calcul. En dessous, des lignes écrites suffisent et le document coûte plus
qu'il ne rapporte.

**Ce que le support résout est une question d'endurance, pas de précision.** Sur une
longue passe, trois choses usent, et aucune n'est la qualité du compte rendu :

- **ne pas voir la fin** — sans repère, on ignore s'il reste cinq vérifications ou
  quarante ;
- **le va-et-vient** permanent entre l'application testée et la conversation ;
- **la reprise** : retrouver, après une interruption, où l'on en était et ce qui restait.

Une passe qu'on abandonne aux deux tiers ne vaut pas une passe courte bien rapportée : ce
qui n'a pas été vérifié ne se sait pas. Le reste — la qualité du rapport — vient
par-dessus, une fois qu'on est allé au bout.

C'est un **outil, pas une discipline** : il ne change rien à ce qui vaut validation
(A-12), il évite seulement de reconstruire à la main, à chaque passe, ce qui a déjà une
forme connue.

**Il ne sert pas qu'à valider un chantier**, et pas qu'aux projets à interface graphique.
Trois autres emplois, avec la même forme : la **recette avant publication** d'une version,
le **contrôle de non-régression** après une montée de version d'une dépendance, et les
projets **sans interface à cliquer** — vérifications en ligne de commande, contrôles de
configuration, procédures d'installation. C'est pourquoi cette option ne dépend pas de
`test-manuel` : elle porte le support, pas la décision de tester à la main.

Quand le document est retenu, huit propriétés le distinguent d'une liste de cases à
cocher :

1. **La progression reste visible en permanence** — combien de vérifications restent, quelle
   proportion du chemin est faite, et lesquelles sont déjà répondues. Ces repères se
   complètent : un chiffre dit l'effort restant, une proportion dit la fin approcher, et
   l'état de chaque ligne montre le chemin parcouru en faisant défiler. C'est la propriété
   qui décide qu'une longue passe se termine au lieu de s'interrompre : elle est
   fonctionnelle, pas décorative.
2. **La passe survit à une interruption.** Sur plusieurs dizaines de vérifications, elle se
   mène en plusieurs fois ; ce qui a déjà été répondu doit se retrouver tel quel à la
   réouverture, sans quoi la reprise coûte plus cher que l'abandon.
3. **Un test = une action et un attendu, écrit avant la passe.** Formulé pour être
   vérifiable sans interprétation, et disant si possible ce que l'observation
   *discrimine* — c'est ce qui distingue un attendu d'une intention.
4. **Les préconditions en tête** : version installée, état de départ, redémarrage
   nécessaire. Une passe menée sur une version périmée produit des résultats faux, et
   cette erreur-là est invisible dans le rapport.
5. **Quatre résultats, mais trois choix seulement** : réussi, échoué, sans réponse. Le
   quatrième — **non applicable** : environnement absent, cas devenu sans objet — ne
   demande pas de bouton supplémentaire, il **se déduit** d'une vérification laissée sans
   réponse *et* commentée, le commentaire servant de raison. La distinction compte, parce
   qu'un état unique rendrait un oubli indiscernable d'un choix — c'est ce qu'A-4 interdit
   à la colonne `Hash`, pour la même raison. Mais elle ne vaut pas d'alourdir chaque ligne
   d'un choix de plus.
6. **Un commentaire par test, atteignable même quand il réussit.** C'est le mécanisme
   central : « réussi, mais le libellé est ambigu » est l'information la plus utile d'une
   passe, et la seule qu'aucune case ne capture. Il peut vivre derrière un bouton — ce qui
   compte est qu'il existe sur un test vert, pas qu'il soit déplié d'avance.
7. **Des numéros stables d'une passe à l'autre** (A-6) : c'est ce qui permet de dire
   « 86 repasse » sans redécrire le test.
8. **Un ordre par vagues**, des fondations vers ce qui en dépend, et un marquage explicite
   des tests dont l'échec invalide la suite — avec la raison, en une ligne.

**Le rapport est la seule partie qui quitte le poste de travail** : ce qui n'y figure pas
n'existe pas pour qui le lit. Il porte donc, au minimum, la **date** et la **version
testée**, les échecs avec leur attendu, **la vague et la criticité** de chacun, les
commentaires, et les numéros restés sans réponse. Un rapport qui affiche une criticité à
l'écran mais l'omet en sortie fait perdre précisément l'information qui devait arriver en
premier.

Il ne liste pas ce qui a réussi : **le silence vaut réussite**, et l'énumération des tests
verts noierait les trois lignes qui comptent. C'est la contrepartie de l'en-tête — sans la
version testée ni la date, un rapport muet sur les réussites ne prouverait plus rien du
tout.

Le squelette et le contrat de sortie exact sont dans [`GABARITS.md`](./GABARITS.md), § 8.

**Règles d'emploi**, dès que le document est retenu :

- **Il vit hors du dépôt** — dans l'espace de brouillons du projet concerné si celui-ci en
  a un (option `tempfiles`).
- **Il n'est pas jetable entre deux passes du même chantier.** Une passe s'enchaîne sur la
  précédente : le document se réédite, ses numéros restent (A-6), et ce qui a déjà été
  répondu ne se ressaisit pas. C'est **à la consignation du chantier** qu'il se supprime,
  pas à la fin de chaque passe.
- **Aucune donnée réelle** : les entrées de test suivent la convention de l'option
  `jetables`, comme le reste du projet.
- **Il ne remplace pas la validation.** « Livré » repose sur le mot de l'utilisateur, pas
  sur des cases cochées (A-12).
- **Le rapport, lui, n'est pas jetable** dans ce qu'il prouve : c'est la trace de
  validation que la remise à niveau ira chercher (A-15, cas B). Ce qu'il établit se résume
  dans l'entrée de journal qui acte le chantier ; s'il mérite d'être conservé en entier,
  c'est une annexe (A-8).

## `dépendances` — politique de dépendances

**`ordinaire`** (défaut) : A-12 s'applique tel quel. **`minimales`** : plugin distribué, code
embarqué, contrainte de taille de livrable — la recherche d'une bibliothèque établie reste
obligatoire, mais l'arbitrage penche explicitement vers l'implémentation maison, et le
principe ne se rediscute pas à chaque fois.

*Pourquoi `ordinaire`* : le code maison sur les sujets réputés simples est un nid de cas
limites oubliés, et il faut une contrainte réelle — pas une préférence — pour y renoncer.

## `discipline-test` — comment teste-t-on sur ce projet

**Sans défaut**, texte libre. Deux questions : comment vérifie-t-on qu'une modification
fonctionne, et **qu'est-ce qui ne doit jamais être touché en test** ?

*Pourquoi sans défaut* : c'est la seule question du cadrage qui ne peut pas avoir de menu
fermé — les vraies disciplines de test sont spécifiques à un environnement hôte et ne
rentrent dans aucune case.

La réponse se rappelle en une ou deux phrases dans l'index de la gouvernance.

## `validateur` — outil de validation de syntaxe

**Sans défaut**, texte libre. A-14 impose de valider ; **quel outil** dépend de
l'écosystème du projet et de ce qui y est disponible. La commande exacte vit dans le
fichier d’instructions.

*Pourquoi sans défaut* : nommer un outil dans la charte la ferait dépendre de logiciels qui
vieillissent, sur des écosystèmes qu'elle ne connaît pas d'avance. Mais une obligation sans
moyen d'exécution nommé est une obligation qu'on croit respecter — d'où la question.

## `veille-conformité` — vérification périodique automatisée

**`non`** (défaut) : la conformité se vérifie en début de session (A-7). **`oui`** : une
tâche planifiée interroge périodiquement le dépôt canonique et compare son identifiant de
version à celui du projet.

*Pourquoi `non` par défaut* : la mise en place dépend de la machine, pas du projet, et une
automatisation non entretenue donne une fausse assurance. La question se pose quand même au
cadrage, parce que la vérification manuelle en début de session est exactement le genre de
geste qu'on ne fait jamais.

Si `oui`, le mandat de la tâche est **strictement borné** :

- récupérer la révision à jour du dépôt canonique ;
- créer une **branche dédiée** dans chaque projet concerné — jamais d'écriture directe sur
  la branche principale ;
- y propager la charte verbatim et, si pertinent, une proposition de remise à niveau — le
  `REMISE-A-NIVEAU.md` d'A-7, avec la fin de vie qu'A-7 lui fixe ;
- **s'arrêter là**. La fusion reste un acte de validation humaine explicite : la tâche ne
  merge jamais d'elle-même et n'écrit jamais directement dans les documents de gouvernance,
  y compris quand l'écart vient d'une détection automatisée.

Elle se génère **localement, par l'assistant de l'environnement concerné** — pas une tâche
centrale unique qui devrait connaître à l'avance tous les environnements et tous les
projets : chacun découvre et couvre les projets réellement présents chez lui.

Sur un poste avec interface graphique, le sondage doit rester invisible. Attention à ne pas
confondre la visibilité de la *tâche* dans l'outil de planification et la visibilité de la
*fenêtre du processus* qu'elle lance : quand le script est lui-même un exécutable à
console, l'invoquer directement ouvre une fenêtre — passer par un lanceur qui la masque
explicitement.

---

# Partie C — Entretien de cadrage

Les options de la partie B ne se devinent pas et ne s'imposent pas : elles se demandent.
L'entretien de cadrage est le moment où on les pose.

## Quand il se déroule

Quatre déclencheurs :

1. **SETUP d'un nouveau projet**, avant de créer quoi que ce soit — les options
   `visibilité`, `attribution` et `authentification` conditionnent ce qui peut être écrit
   dès le premier commit.
2. **Transposition d'un existant** (A-15, cas A).
3. **Remise à niveau** (A-15, cas B) : on repose les questions marquées « non tranché » et
   celles dont la réponse ne correspond plus au projet.
4. **Révision additive de la charte** : on ne repose **que les nouvelles questions**, avec
   leur défaut déjà appliqué. C'est une notification à arbitrer, pas un entretien complet.
5. **Sur demande explicite, à tout moment** — c'est ce que déclenche l'option `mot-cadrage`.
   Un projet change de nature sans prévenir : un prototype devient un produit, un dépôt privé
   devient public, un outillage trouve son usage. Aucun des quatre autres déclencheurs ne se
   produit alors, et le profil vieillit en silence. La relance peut être **complète ou
   ciblée sur quelques clés** — rouvrir tout l'entretien pour changer une valeur serait la
   meilleure façon de ne jamais le rouvrir.

## Profils de départ

Poser vingt-cinq questions à chaque SETUP garantit qu'il ne sera jamais mené jusqu'au bout.
L'entretien commence donc par **un mot**, puis se poursuit en écrasant les points qu'on veut.

| Profil | Pour quel projet |
|---|---|
| **`minimal`** | Prototype, expérimentation, projet dont on ne sait pas encore s'il vivra. Allège tout ce qui coûte plus qu'il ne protège à ce stade. |
| **`standard`** | Le cas ordinaire : tous les défauts de la partie B. |
| **`complet`** | Projet installé, suivi dans la durée. Active ce que les autres profils laissent de côté. |

**Ce que chaque profil pose exactement est dans [`GABARITS.md`](./GABARITS.md), § 7** — une
seule table, un seul endroit. La redire ici en produirait une seconde qui divergerait, ce
qu'A-2 interdit précisément.

Les neuf questions **sans défaut** (`visibilité`, `attribution`, `authentification`,
`validation`, `jetables`, `discipline-test`, `validateur`, `mot-cloture`, `mot-cadrage`) ne
figurent dans aucun profil et se posent **quel qu'il soit** : aucun profil ne peut y répondre
à votre place.

## Comment mener l'entretien

- **Par blocs**, dans l'ordre de la partie B, chaque bloc pouvant être expédié d'un
  « défauts partout ».
- **Chaque question expose ses valeurs, son défaut et le pourquoi du défaut.** Une question
  posée sans son motif appelle une réponse au hasard.
- **Jamais de blocage sur une question à défaut.** Une question laissée sans réponse prend
  son défaut et s'inscrit dans `PROFIL.md` comme `défaut appliqué, non tranché` — la
  différence entre « on a choisi ça » et « on n'a rien choisi » reste visible, donc
  rattrapable, et ce sont ces questions-là qu'on repose à la remise à niveau.
- **Les questions sans défaut, elles, bloquent la création** tant qu'elles n'ont pas de
  réponse : leurs conséquences sont irréversibles ou coûteuses à inverser.

## Où vivent les réponses — `PROFIL.md`

Un fichier **`PROFIL.md`** à la racine de `.AIRules/`, **toujours en Markdown** quel que
soit le format retenu par le projet.

*Pourquoi Markdown, même sur un projet HTML* : ce n'est pas un document de lecture, c'est
un **état de configuration**. Il doit rester `diff`-able, comparable d'un projet à l'autre,
et lisible par un outil.

Il porte : le profil de départ, l'identifiant de version de la charte sous laquelle le
cadrage a été fait, une ligne par option (clé, choix, pourquoi), et sa propre date de
dernière revue. Le gabarit complet et un exemple rempli par profil sont dans `GABARITS.md`.

`PROFIL.md` **n'est pas une copie conforme** : c'est le seul fichier de `.AIRules/` prescrit
par cette charte qui soit propre au projet.

## Changer une réponse

Une réponse peut changer — un prototype devient un produit, un dépôt privé devient public,
un outillage trouve son usage. Mais un changement de `PROFIL.md` est un **changement
structurant** (A-13) : proposition, validation explicite, puis une ligne au journal qui
acte la décision et son motif.

`PROFIL.md` porte la valeur courante, le journal porte l'histoire. C'est ce qui distingue
une décision d'un contournement — typiquement passer `seuil` à `tout-libre` un jour de
fatigue.

---

# Environnement de travail

Hors gouvernance de projet, mais utile à toute session : **garder en permanence sous les
yeux le niveau de consommation de contexte et de quota**, sans avoir à le demander.

Une statusline utile affiche : le pourcentage de fenêtre de contexte consommé, les quotas
d'usage avec le temps restant avant remise à zéro, le modèle actif, et la branche Git
courante. Une ligne par indicateur, avec un code couleur par palier.

Une implémentation prête à l'emploi, indépendante de toute machine, est fournie dans le
dépôt canonique : **`outils/`** (script, fragment de configuration, notice d'installation).
Elle vit là plutôt qu'ici parce qu'elle relève du poste de travail et non du projet — et
elle ne voyage pas dans les `.AIRules/`.

---

# Index des projets d'un workspace

Quand cette charte est placée à la racine d'un workspace regroupant plusieurs projets,
tenir ici la liste des projets et le lien vers leur gouvernance respective :

| Projet | Gouvernance |
|---|---|
| `{{nom-du-dossier}}` | [`{{nom-du-dossier}}/.AIRules/README.html`](./{{nom-du-dossier}}/.AIRules/README.html) |

**Ce gabarit reste vide ici** : cette charte est un document canonique partagé, poussé tel
quel dans n'importe quel projet ou workspace — elle ne cite aucun projet actif, aucun nom
de dépôt, aucune URL réelle. L'instanciation concrète vit dans le fichier d’instructions du
workspace
(A-11).

---

# Historique des révisions

| Version | Régime |
|---|---|
| `20260804-071239` | purement additive |
| `20260804-064238` | touche le noyau |
| `20260803-200821` | purement additive |
| `20260803-182826` | purement additive |
| `20260731-204511` | purement additive |
| `20260731-203812` | touche le noyau |
| `20260731-150737` | touche le noyau |
| `20260731-135838` | touche le noyau |

Les révisions antérieures à ces identifiants ne sont pas listées ici : elles précèdent
l'introduction du régime d'application.

**Ce que chaque révision a changé** vit dans le changelog du dépôt canonique :
<https://github.com/TooMuhtsh/Claude-Governance/blob/master/CHANGELOG.md>. Cette table-ci ne
porte que le **régime**, parce que c'est la seule information dont un projet cloné sans accès
à ce dépôt ait besoin — c'est elle qui décide si une remise à niveau se propage d'office ou
se propose (A-7). Le récit détaillé, lui, ne se lit qu'au moment de réviser, donc là où l'on
révise.

---
*Version de cette charte : **`20260804-071239`**. C'est cet identifiant que reprend la
mention « Conforme à la charte de gouvernance, version {{id}} » dans le pied de page de
l'index de gouvernance de chaque projet.*
