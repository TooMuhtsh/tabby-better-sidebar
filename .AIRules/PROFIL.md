# tabby-better-sidebar — Profil de gouvernance

Réponses de cadrage de ce projet. La charte qui les rend nécessaires est
[`GOUVERNANCE-IA.md`](./GOUVERNANCE-IA.md), partie B.

- **Profil de départ** : `complet`
- **Charte au moment du cadrage** : `20260731-150737`
- **Dernière revue de ce profil** : 2026-07-31

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
| `attribution` | `oui` | trailers `Co-Authored-By` et `Claude-Session` ; pratique déjà présente dans l'historique public, revenir dessus imposerait de le réécrire |
| `authentification` | compte `TooMuhtsh`, `gh` CLI authentifié via le trousseau de l'OS, opérations Git en HTTPS | identité de commit configurée **localement** à ce dépôt, pas globalement ; ne jamais committer sous une autre adresse sans confirmation |
| `branches` | `branche` | tranché au cadrage, en changement de la pratique antérieure : un chantier non abouti et sa documentation arrivent ensemble sur `master`, ce qui garantit A-10 mécaniquement plutôt que par vigilance |
| `seuil` | `strict` | un statut de chantier engage ; seul le contexte s'écrit au fil de l'eau |
| `roadmap-avant-code` | `oui` | une idée exprimée en vrac se consigne avec son design étudié et attend l'arbitrage ; l'implémentation démarre sur consigne explicite |
| `mot-cloture` | `CLOTURE` | transverse au workspace : feu vert d'A-3, mise à jour des documents, vérification de `CLAUDE.md`, commit, push — la chaîne s'arrête à la première étape qui échoue et dit où |
| `mot-cadrage` | `GOUVERNANCE` | transverse au workspace : rouvre cet entretien, en entier ou sur les clés nommées après le mot |
| `validation` | test manuel dans Tabby, plugin monté par jonction NTFS dans le dossier de plugins installés, **process `Tabby.exe` tué et relancé en entier** après chaque modification — recharger la fenêtre ne suffit pas, l'état du chargeur de plugins Node est global au process | un build vert ne prouve rien ici : Tabby avale silencieusement la plupart des erreurs de chargement de plugin |
| `jetables` | `grp-zzz-test-*` — groupes et profils ajoutés à la main dans `config.yaml`, supprimés après coup | préfixe qui trie en fin de liste et se repère d'un coup d'œil parmi de vraies entrées |
| `test-manuel` | `oui` | checklist de test manuel précise et écoute passive des traces ; escalade vers un banc de mesure automatisé seulement aux trois conditions nommées par la charte |
| `dépendances` | `ordinaire` | tranché au cadrage : A-12 s'applique tel quel, chaque besoin d'outillage se repose au cas par cas plutôt que de pencher d'avance vers le code maison |
| `discipline-test` | Jamais de manipulation directe des vraies entrées de `config.store.groups` / `.profiles` — tout test destructif passe par des entrées `grp-zzz-test-*`. Toujours `structuredClone()` après `getProfileGroups()` / `getProfiles()` avant toute mutation. La configuration est chiffrée par le coffre-fort : un déchiffrement temporaire pour observer l'état réel est admis, le protocole Chrome DevTools (`--debug --remote-debugging-port`) reste réservé à la lecture des erreurs. | une mutation accidentelle d'un objet vivant de `config.store` a déjà corrompu la configuration de production une fois |
| `validateur` | `html-validate` (devDependency), `npm run lint:airules` | commande exacte et périmètre dans `CLAUDE.md` ; devDependency, donc hors du livrable du plugin |
| `veille-conformité` | `oui` | une tâche planifiée locale interroge le dépôt canonique et propage un écart **sur une branche dédiée** ; elle ne fusionne jamais d'elle-même et n'écrit jamais dans les documents de gouvernance |

## Questions non tranchées

Aucune. Les vingt-deux options ont reçu une réponse explicite au cadrage du 2026-07-31 ;
aucune ligne ne porte « défaut appliqué, non tranché ».

## Historique des changements

Un changement de ce fichier est un changement structurant : il se propose, se valide, et
laisse une ligne au journal. Le tableau ci-dessus porte la valeur courante ; le journal
porte l'histoire.
