# tabby-better-sidebar — Profil de gouvernance

Réponses de cadrage de ce projet. La charte qui les rend nécessaires est
[`GOUVERNANCE-IA.md`](./GOUVERNANCE-IA.md), partie B.

- **Profil de départ** : `complet`
- **Charte au moment du cadrage** : `20260731-204511`
- **Dernière revue de ce profil** : 2026-08-03 (entretien complet relu ; seule `seuil` a changé)

## Choix

| Clé | Choix | Pourquoi |
|---|---|---|
| `format` | `html` | quatre documents HTML statiques et une feuille de style partagée, en place depuis l'origine du projet ; confirmé au cadrage |
| `documents` | `4` | `README` · `AI-CONTEXT` · `AI-HISTORY` · `ROADMAP`, séparés depuis l'origine |
| `fichier-instructions` | `CLAUDE.md` | seul assistant qui consomme ce dépôt aujourd'hui |
| `statuts` | `complet` | « À revérifier » sert déjà aux pièges suspendus au comportement non contractuel de Tabby ; « Adopté » devient utilisable avec `outillage = oui` |
| `outillage` | `oui` | le plugin est d'abord l'outil quotidien de son auteur : « Adopté » distingue une fonctionnalité qui marche d'une fonctionnalité réellement utilisée dans le flux de travail |
| `tempfiles` | `oui` | `.tempfiles/` est déjà déclaré dans `.gitignore` |
| `distant` | `oui` | `github.com/TooMuhtsh/tabby-better-sidebar` |
| `visibilité` | `public` | dépôt public dès le premier commit ; la liste de ce qui reste dehors est celle de l'option `visibilité` de la charte |
| `attribution` | `non` | tranché le 2026-08-01, en remplacement de `oui` : aucune métadonnée d'attribution IA dans les messages de commit. La trace de la collaboration reste **dans les documents de gouvernance**, qui la portent avec leur contexte, plutôt que dans un historique Git où elle est bruit. L'historique existant a été purgé dans le même geste — décision assumée malgré la réécriture des hashs |
| `authentification` | compte `TooMuhtsh`, `gh` CLI authentifié via le trousseau de l'OS, opérations Git en HTTPS | identité de commit configurée **localement** à ce dépôt, pas globalement ; ne jamais committer sous une autre adresse sans confirmation |
| `branches` | `branche` | tranché au cadrage, en changement de la pratique antérieure : un chantier non abouti et sa documentation arrivent ensemble sur `master`, ce qui garantit A-10 mécaniquement plutôt que par vigilance |
| `seuil` | `roadmap-libre` | tranché le 2026-08-03, en remplacement de `strict`. La roadmap s'écrit librement, le **journal reste sous validation**. Motif tiré de deux cas constatés le même jour : un chantier corrige en passant ce qu'une autre fiche décrit — les trois défauts mineurs du voisinage `config.store`, puis `build:prod` et `filesize` —, la fiche voisine n'est pas la sienne, et le feu vert nécessaire pour la rectifier n'arrive jamais. Une roadmap périmée ment autant qu'une roadmap écrite sans arbitrage ; c'était le risque inverse, et c'est celui qui s'est réalisé. La contrepartie est assumée : un statut peut désormais bouger sans arbitrage explicite |
| `roadmap-avant-code` | `oui` | une idée exprimée en vrac se consigne avec son design étudié et attend l'arbitrage ; l'implémentation démarre sur consigne explicite |
| `mot-cloture` | `MAJ` | transverse au workspace : feu vert d'A-3, mise à jour des documents, vérification de `CLAUDE.md`, commit, push — la chaîne s'arrête à la première étape qui échoue et dit où. Remplace `CLOTURE` depuis le 2026-07-31. **Moins distinctif que le précédent** — c'est l'abréviation usuelle de « mise à jour », si bien que la règle de désambiguïsation rappelée dans `CLAUDE.md` porte ici l'essentiel du travail : dans le doute, demander plutôt qu'exécuter |
| `mot-cadrage` | `GOUVERNANCE` | transverse au workspace : rouvre cet entretien, en entier ou sur les clés nommées après le mot |
| `validation` | test manuel dans Tabby, plugin monté par jonction NTFS dans le dossier de plugins installés, **process `Tabby.exe` tué et relancé en entier** après chaque modification — recharger la fenêtre ne suffit pas, l'état du chargeur de plugins Node est global au process | un build vert ne prouve rien ici : Tabby avale silencieusement la plupart des erreurs de chargement de plugin |
| `jetables` | `grp-zzz-test-*` — groupes et profils ajoutés à la main dans `config.yaml`, supprimés après coup | préfixe qui trie en fin de liste et se repère d'un coup d'œil parmi de vraies entrées |
| `test-manuel` | `oui` | checklist de test manuel précise et écoute passive des traces ; escalade vers un banc de mesure automatisé seulement aux trois conditions nommées par la charte |
| `dépendances` | `ordinaire` | tranché au cadrage : A-12 s'applique tel quel, chaque besoin d'outillage se repose au cas par cas plutôt que de pencher d'avance vers le code maison |
| `discipline-test` | Jamais de manipulation directe des vraies entrées de `config.store.groups` / `.profiles` — tout test destructif passe par des entrées `grp-zzz-test-*`. Toujours `structuredClone()` après `getProfileGroups()` / `getProfiles()` avant toute mutation. La configuration est chiffrée par le coffre-fort : un déchiffrement temporaire pour observer l'état réel est admis, le protocole Chrome DevTools (`--debug --remote-debugging-port`) reste réservé à la lecture des erreurs. | une mutation accidentelle d'un objet vivant de `config.store` a déjà corrompu la configuration de production une fois |
| `validateur` | `html-validate` (devDependency), `npm run lint:airules` | commande exacte et périmètre dans `CLAUDE.md` ; devDependency, donc hors du livrable du plugin |
| `veille-conformité` | `oui` — **mais la tâche est locale au poste de l'auteur et n'est pas versionnée ici** | une tâche planifiée interroge périodiquement le dépôt canonique et propage un écart **sur une branche dédiée** ; elle ne fusionne jamais d'elle-même et n'écrit jamais dans les documents de gouvernance. Elle vit dans le profil utilisateur de la machine, hors de ce dépôt, parce qu'elle relève du poste de travail et non du projet : un clone sur une autre machine **n'en hérite pas** et doit la regénérer localement s'il la veut. En son absence, la conformité se vérifie à la main en début de session (A-7), en comparant l'identifiant de `GOUVERNANCE-IA.md` à celui du dépôt canonique. |

## Questions non tranchées

Aucune. Les vingt-deux options ont reçu une réponse explicite au cadrage du 2026-07-31 ;
aucune ligne ne porte « défaut appliqué, non tranché ». Les vingt-deux ont été relues le
2026-08-03 sous la charte `20260731-204511` : les clés de la charte et celles de ce tableau
correspondent une à une, et seule `seuil` a changé de valeur.

## Historique des changements

Un changement de ce fichier est un changement structurant : il se propose, se valide, et
laisse une ligne au journal. Le tableau ci-dessus porte la valeur courante ; le journal
porte l'histoire.
