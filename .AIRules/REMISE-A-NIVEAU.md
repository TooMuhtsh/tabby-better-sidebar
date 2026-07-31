# Remise à niveau proposée — charte `20260731-135838`

**Ce fichier est une proposition, pas un travail appliqué.** Il a été produit par la veille de
conformité automatisée en même temps que la copie verbatim de `GOUVERNANCE-IA.md` et de
`GABARITS.md`. Aucun document de gouvernance de ce projet n'a été modifié. L'arbitrage revient au
projet : ce fichier peut être suivi, amendé, ou supprimé avec la branche.

## Pourquoi une proposition et non une application

La révision `20260731-135838` se déclare elle-même *touche le noyau*. Selon A-7, une révision de ce
régime **ne s'applique jamais d'office** : l'écart se signale, la remise à niveau se propose. Un
projet peut légitimement rester sur une convention antérieure. Ce qui se propage d'office, ce sont
les deux fichiers canoniques — une copie périmée n'est pas une convention assumée, c'est une copie
qu'on ne peut plus comparer par `diff`.

L'écart entre l'identifiant de la copie (`20260731-135838`) et la mention de conformité du pied de
page du `README` (encore « du 2026-07-30 ») **est** le signal, et c'est un état normal tant que la
remise à niveau n'a pas été arbitrée.

## Ce qui a changé dans la charte

Refonte structurelle. Le document se scinde en trois parties : un **noyau** de quinze invariants
prescriptifs (`A-1` à `A-15`), dix-neuf **options** décidées par projet portant chacune son défaut
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

## Ce que ce projet devrait ajuster

Constaté par inventaire de `.AIRules/` sur cette branche. Rien n'est appliqué.

### 1. Créer `PROFIL.md`

Le projet n'en a pas. Gabarit au § 7 de `GABARITS.md`. Sept options sont **sans défaut** et doivent
donc recevoir une réponse explicite plutôt qu'être héritées : `visibilité`, `attribution`,
`authentification`, `validation`, `jetables`, `discipline-test`, `validateur`. Plusieurs ont déjà
une réponse *de fait* dans ce projet (dépôt public, attribution IA en trailer de commit, convention
de données de test) : le travail consiste à l'écrire, pas à la décider.

Deux options méritent une attention particulière :

- `veille-conformité` — défaut `non`, mais vaut `oui` de fait pour ce projet : la tâche planifiée
  locale qui a produit cette branche en est la preuve.
- `format` — `html` de fait, conforme au défaut ; à confirmer explicitement.

### 2. Migrer les références à l'ancienne numérotation

Six occurrences de « Règle N » hors de la charte elle-même :

| Fichier | Ligne | Référence |
|---|---|---|
| `README.html` | 69 | Règle 7, Cas B → `A-15` Cas B |
| `README.html` | 104 | Règle 1 → `A-1` / `A-7` / `A-10` |
| `AI-HISTORY.html` | 129 | Règle 7 Cas B |
| `AI-HISTORY.html` | 133 | Règle 1 |
| `AI-HISTORY.html` | 156 | Règle 3 → `A-11` |
| `ROADMAP.html` | 990 | Règle 7, Cas B → `A-15` Cas B |

**Les trois occurrences d'`AI-HISTORY.html` ne se corrigent pas** : `A-4` impose un journal en ajout
seul. Elles nommaient la règle telle qu'elle existait à la date de l'entrée ; les réécrire falsifie
le journal. Seuls `README.html` et `ROADMAP.html` sont concernés.

La table de correspondance en fin de charte donne l'équivalence pour chaque ancienne référence —
elle disparaîtra à la révision suivante, ce qui borne la fenêtre pour faire cette migration
confortablement.

### 3. Mettre à jour la mention de conformité

`README.html`, pied de page : « Conforme à la charte de gouvernance du 2026-07-30 » devient une
mention par identifiant, `Conforme à la charte de gouvernance, version 20260731-135838`. À ne faire
qu'**au terme** de la remise à niveau : cette ligne atteste que le projet suit la charte, pas que sa
copie est à jour.

### 4. Envisager un audit complet (`A-15`, Cas B)

Une révision de charte touchant le noyau est l'un des déclencheurs nommés du Cas B. L'audit porte
sur le contexte (invariants confrontés au code réel), la roadmap (statuts confrontés à l'état réel
du dépôt), le journal (entrée datée actant la revue, sans correction rétroactive) et l'index. Il se
termine par la mise à jour effective des dates de dernière revue — une date qui ne bouge pas signifie
que la revue n'a pas eu lieu.

Ce projet a des chantiers en attente de validation en conditions réelles ; l'audit de roadmap du Cas
B est précisément l'endroit où un statut « livré » sans trace de validation redescend.

---

*Aucune des propositions ci-dessus n'est appliquée par cette branche. Seuls `GOUVERNANCE-IA.md` et
`GABARITS.md` y ont été copiés, verbatim depuis le dépôt canonique et vérifiés par `diff`.*
