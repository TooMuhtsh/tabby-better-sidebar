# Remise à niveau — charte `20260731-150737`

**Arbitrée le 2026-07-31 : la branche a été fusionnée et la remise à niveau est engagée.** Ce
fichier a été produit par la veille de conformité automatisée en même temps que la copie verbatim de
`GOUVERNANCE-IA.md` et de `GABARITS.md` ; il était alors une proposition. Il ne l'est plus, et sert
désormais d'**état d'avancement** — le détail de chaque item ci-dessous porte son statut. Il se
supprime quand les quatre sont faits.

| Item | Statut |
|---|---|
| 1. Créer `PROFIL.md` | **Fait** — cadrage complet, profil `complet`, 22 options tranchées |
| 2. Migrer les références « Règle N » | **Fait** — `README.html` et `ROADMAP.html` ; celles d'`AI-HISTORY.html` restent, A-4 |
| 3. Mention de conformité du pied de page | **À faire, en dernier** — atteste que le projet suit la charte, pas que sa copie est à jour |
| 4. Audit complet A-15 Cas B | **À faire** — contexte, roadmap, journal, index, puis dates de dernière revue |

## Pourquoi c'était une proposition et non une application

La révision `20260731-150737` se déclare elle-même *touche le noyau*. Selon A-7, une révision de ce
régime **ne s'applique jamais d'office** : l'écart se signale, la remise à niveau se propose. Un
projet peut légitimement rester sur une convention antérieure. Ce qui se propage d'office, ce sont
les deux fichiers canoniques — une copie périmée n'est pas une convention assumée, c'est une copie
qu'on ne peut plus comparer par `diff`.

L'écart entre l'identifiant de la copie (`20260731-150737`) et la mention de conformité du pied de
page du `README` (encore « du 2026-07-30 ») **est** le signal, et c'est un état normal tant que la
remise à niveau n'a pas été arbitrée.

> **Cette proposition couvre deux révisions.** Ouverte pour `20260731-135838`, elle a été
> mise à jour vers `20260731-150737` avant toute fusion — les branches de propagation sont des
> propositions, pas de l'historique, et A-4 ne les couvre pas. La seconde révision ajoute :
> l'option `fichier-instructions` (le fichier d'instructions n'est plus nommé en dur, et sa
> vérification devient un point de passage de toute écriture de gouvernance), les options
> `mot-cloture` et `mot-cadrage`, et un cinquième déclencheur d'entretien « sur demande
> explicite ». Trois questions de plus au cadrage, dont deux sans défaut.

## Ce qui a changé dans la charte

Refonte structurelle. Le document se scinde en trois parties : un **noyau** de quinze invariants
prescriptifs (`A-1` à `A-15`), vingt-deux **options** décidées par projet portant chacune son défaut
*et le motif de ce défaut*, et un **entretien de cadrage** qui les pose au lieu de les supposer.
L'ancienne numérotation « Règle 1 à 7 » disparaît.

- **Identifiant de version horodaté** `AAAAMMJJ-HHMMSS` en remplacement de la date de pied de page,
  qui ne distinguait pas deux révisions du même jour.
- Les identifiants `A-x` et les clés d'option sont **déclarés stables**, au même titre que ceux
  qu'`A-6` impose aux projets.
- Le **format des documents devient une option** (`format`), `html` par défaut, avec un gabarit
  Markdown équivalent.
- Les squelettes de documents et le modèle de profil sortent dans **`GABARITS.md`**, lu seulement au
  moment d'écrire — nouveau fichier, apporté par cette branche.
- Les réponses de cadrage vivent dans un nouveau **`PROFIL.md`** par projet.
- Une **trace de dérive** devient obligatoire (`A-5`) et constitue la deuxième exception nommée au
  feu vert.
- Une révision de charte suit désormais **deux régimes**, additif ou touchant le noyau (`A-7`).
- La vérification d'un export d'API se généralise en **« ne jamais conclure sur une seule source »**
  (`A-12`).
- Le dépôt public reçoit une **liste explicite de ce qui reste dehors** (option `visibilité`).
- Le script de statusline quitte la charte pour le dossier `outils/` du dépôt canonique — dossier
  qui, par construction, **ne se propage pas** dans les projets.
- Une **table de correspondance temporaire** relie l'ancienne numérotation aux nouvelles sections.
  Elle est explicitement datée : à retirer à la révision suivante.

## Ce que ce projet doit ajuster

Constaté par inventaire de `.AIRules/`. Chaque item porte son statut.

### 1. Créer `PROFIL.md` — **fait le 2026-07-31**

Cadrage complet mené sous cette charte, profil de départ `complet` : les vingt-deux options ont une
réponse explicite, aucune ne reste « défaut appliqué, non tranché ». Deux réponses **changent une
pratique** plutôt que d'enregistrer l'existant — `branches` passe à `branche` (le projet travaillait
en direct sur `master`) et `outillage` vaut `oui`, ce qui rend l'état « Adopté » utilisable. Le
`validateur`, qui était sans réponse alors qu'`A-14` impose de valider, est `html-validate` via
`npm run lint:airules`. Le constat d'origine est conservé ci-dessous.

Le projet n'en avait pas. Gabarit au § 7 de `GABARITS.md`. Neuf options sont **sans défaut** et doivent
donc recevoir une réponse explicite plutôt qu'être héritées : `visibilité`, `attribution`,
`authentification`, `validation`, `jetables`, `discipline-test`, `validateur`, `mot-cloture`,
`mot-cadrage`. Plusieurs ont déjà une réponse *de fait* dans ce projet (dépôt public, attribution
IA en trailer de commit, convention de données de test) : le travail consiste à l'écrire, pas à la
décider.

**`mot-cloture` et `mot-cadrage` n'ont, eux, aucune réponse de fait** : ce sont des mots que
l'utilisateur choisit, et le mécanisme reste inutilisable tant qu'ils ne sont pas écrits ici. Le
premier déclenche en un geste la chaîne complète — feu vert d'`A-3`, mise à jour des documents,
vérification du fichier d'instructions, commit, push. Le second rouvre l'entretien de cadrage, en
entier ou sur quelques clés. Une fois choisis, ils se rappellent dans le fichier d'instructions du
projet, sans quoi ils ne sont connus que de celui qui les a écrits.

Deux options méritent une attention particulière :

- `veille-conformité` — défaut `non`, mais vaut `oui` de fait pour ce projet : la tâche planifiée
  locale qui a produit cette branche en est la preuve.
- `format` — `html` de fait, conforme au défaut ; à confirmer explicitement.

### 2. Migrer les références à l'ancienne numérotation — **fait le 2026-07-31**

Six occurrences de « Règle N » hors de la charte elle-même :

| Fichier | Ligne | Référence | Traitement |
|---|---|---|---|
| `README.html` | 69 | Règle 7, Cas B | → `A-15` Cas B |
| `README.html` | 104 | Règle 1 | → `A-10` |
| `AI-HISTORY.html` | 129 | Règle 7 Cas B | **laissée en place** |
| `AI-HISTORY.html` | 133 | Règle 1 | **laissée en place** |
| `AI-HISTORY.html` | 156 | Règle 3 | **laissée en place** |
| `ROADMAP.html` | 990 | Règle 7, Cas B | → `A-15` Cas B |

**Les trois occurrences d'`AI-HISTORY.html` ne se corrigent pas** : `A-4` impose un journal en ajout
seul. Elles nommaient la règle telle qu'elle existait à la date de l'entrée ; les réécrire falsifie
le journal. Seuls `README.html` et `ROADMAP.html` étaient concernés.

Deux affirmations devenues fausses ont été corrigées dans le même geste, l'une et l'autre situant
l'original de la charte « à la racine du workspace » : c'est le miroir de commodité, pas la source,
qui vit dans un dépôt public dédié. La comparaison de conformité, décrite dans les deux documents
comme une comparaison de **dates**, porte désormais sur l'identifiant `AAAAMMJJ-HHMMSS`.

La table de correspondance en fin de charte donne l'équivalence pour chaque ancienne référence —
elle disparaîtra à la révision suivante, ce qui borne la fenêtre pour faire cette migration
confortablement.

### 3. Mettre à jour la mention de conformité — **à faire, en dernier**

`README.html`, pied de page : « Conforme à la charte de gouvernance du 2026-07-30 » devient une
mention par identifiant, `Conforme à la charte de gouvernance, version 20260731-150737`. À ne faire
qu'**au terme** de la remise à niveau, donc **après l'item 4** : cette ligne atteste que le projet
suit la charte, pas que sa copie est à jour. Tant qu'elle porte encore sa date, l'écart avec
l'identifiant de `GOUVERNANCE-IA.md` est le signal normal d'une remise à niveau engagée mais non
terminée.

### 4. Envisager un audit complet (`A-15`, Cas B) — **à faire**

Une révision de charte touchant le noyau est l'un des déclencheurs nommés du Cas B. L'audit porte
sur le contexte (invariants confrontés au code réel), la roadmap (statuts confrontés à l'état réel
du dépôt), le journal (entrée datée actant la revue, sans correction rétroactive) et l'index. Il se
termine par la mise à jour effective des dates de dernière revue — une date qui ne bouge pas signifie
que la revue n'a pas eu lieu.

Ce projet a des chantiers en attente de validation en conditions réelles ; l'audit de roadmap du Cas
B est précisément l'endroit où un statut « livré » sans trace de validation redescend.

---

*Les items 1 et 2 sont appliqués sur `master` depuis le 2026-07-31 ; les items 3 et 4 restent à
faire, dans cet ordre. `GOUVERNANCE-IA.md` et `GABARITS.md` sont des copies verbatim du dépôt
canonique, vérifiées par comparaison des blobs Git — voir le piège
[#47](AI-CONTEXT.html#piege-47), un `diff` nu de ces fichiers est trompeur sur ce poste.*
