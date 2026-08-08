# Gabarits de gouvernance

Pièce compagnon de [`GOUVERNANCE-IA.md`](./GOUVERNANCE-IA.md). Elle porte les squelettes de
documents, la table de conversion entre formats, et le modèle de `PROFIL.md`.

**Ce fichier ne se lit pas en début de session.** Il s'ouvre au moment de créer un document,
d'en restructurer un, ou de remplir un profil — et se referme après. La charte est ce qu'on
garde en tête ; ceci est ce qu'on consulte.

## Deux niveaux d'autorité, à ne pas confondre

| Niveau | Ce que ça recouvre | Peut-on y déroger ? |
|---|---|---|
| **Ossature** | L'ordre des sections, la présence des sections structurantes (sommaire, compteur, vue d'ensemble, protocole), la sémantique des encadrés et des statuts, les règles de lien. | **Non.** C'est ce qui rend un document prévisible : on sait où chercher sans relire. |
| **Rédaction** | Le contenu des paragraphes, les catégories proposées, le nombre de lignes, le ton, les exemples. | **Oui.** Ce qui suit est un point de départ, pas un moule. |

Sauf mention contraire, ce qui est présenté comme une **liste ordonnée de sections** relève
de l'ossature, et ce qui est présenté en prose relève de la rédaction.

---

# 1. Squelette d'un document principal

## Variante `html` (défaut)

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

- La navbar est **identique sur tous les documents principaux** ; seul le lien de la page
  courante porte `class="current"`.
- Elle est **réservée aux documents principaux** : une page d'annexe ou d'archive n'en a
  pas (§ 5).
- `style.css` est partagé par toutes les pages du projet — un seul fichier, jamais dupliqué
  (§ 4).

## Variante `markdown`

```markdown
[Accueil](README.md) · [Contexte](AI-CONTEXT.md) · [Historique](AI-HISTORY.md) · [Roadmap](ROADMAP.md)

# {{titre}}

*Dernière revue : {{date}}*

<!-- contenu -->

---
*{{nom du projet}} · {{note de bas de page}}*
```

- La ligne de navigation remplace la navbar, avec la même règle : identique partout, la page
  courante en texte brut au lieu d'un lien.
- Pas de feuille de style : le rendu est celui de la forge ou de l'éditeur.

## Ajouter un troisième format

Un format non prévu ici est acceptable, à condition de fournir dans ce fichier **son
squelette et sa ligne dans la table de conversion** — une seule structure, plusieurs rendus.
Un format ajouté sans son gabarit est un projet qui diverge.

---

# 2. Table de conversion entre formats

Ce qui doit se dire dans les deux formats, et comment.

## Statuts

| État | `html` | `markdown` |
|---|---|---|
| Livré | `<span class="pill done">✅ Livré</span>` | `✅ **Livré**` |
| Adopté | `<span class="pill adopted">🎯 Adopté</span>` | `🎯 **Adopté**` |
| En cours | `<span class="pill progress">🚧 En cours</span>` | `🚧 **En cours**` |
| Prévu | `<span class="pill planned">📋 Prévu</span>` | `📋 **Prévu**` |
| Écarté | `<span class="pill out">⛔ Écarté</span>` | `⛔ **Écarté**` |
| À revérifier | `<span class="pill warn">⚠️ À revérifier</span>` | `⚠️ **À revérifier**` |

L'emoji fait partie du statut, pas de la décoration : c'est ce qui le rend repérable en
survol dans les deux formats.

## Encadrés

| Niveau | `html` | `markdown` |
|---|---|---|
| `note` | `<div class="callout note"><p class="callout-title">Titre</p>…</div>` | `> **ℹ️ Titre**`<br>`> …` |
| `warning` | `<div class="callout warning">…</div>` | `> **⚠️ Titre**`<br>`> …` |
| `important` | `<div class="callout important">…</div>` | `> **❗ Titre**`<br>`> …` |

## Ancres et liens

| Usage | `html` | `markdown` |
|---|---|---|
| Ancre de piège | `<h3 id="piege-N">#N — Titre</h3>` | `### <a id="piege-N"></a>#N — Titre` |
| Ancre de catégorie | `<h2 id="cat-slug">` | `## <a id="cat-slug"></a>` |
| Ancre de chantier | `<h3 id="slug-chantier">` | `### <a id="slug-chantier"></a>` |
| Lien interne | `href="AI-CONTEXT.html#piege-4"` | `](AI-CONTEXT.md#piege-4)` |

**Toujours en chemin relatif** (A-14). Jamais de chemin absolu, jamais de chemin de machine,
jamais de `/` initial.

## Ligne de texte secondaire

`<p class="muted">…</p>` en HTML, `*…*` (italique) en Markdown.

---

# 3. Plan de chaque document

## `README` — index et protocole

Ordre des sections après le `<h1>{{Nom du projet}} — Gouvernance IA</h1>` :

1. **Paragraphe de description** du projet — 2 à 4 phrases : ce que c'est, le problème
   central qu'il adresse.
2. **Liste** : emplacement du dépôt de code, lien vers le dépôt distant s'il existe, rappel
   que `.AIRules/` vit dans le même dépôt.
3. **Ligne secondaire** rappelant que ce dossier est versionné avec le code — donc qu'un
   `git clone` récupère tout.
4. **`Structure`** : tableau à deux colonnes (`Fichier` / `Contenu`) listant les autres
   documents, `PROFIL.md` compris, avec une phrase de description chacun. Sert de point
   d'entrée cliquable. C'est **le seul endroit de l'index qui mentionne le cadrage** : une
   ligne et un lien vers `PROFIL.md`, jamais un résumé de ses choix. Un résumé ferait de
   l'index une seconde source de vérité, et c'est celle qu'on oublie de corriger.
5. **`Protocole`**, trois sous-sections :
   - **`En début de session sur ce projet`** : liste ordonnée des étapes avant de coder —
     typiquement lire le contexte (invariants et pièges), lire le haut du journal (où en est
     le dernier chantier actif), vérifier l'état réel du projet avant de faire confiance à
     la doc (build à jour, dernier commit, état d'un service externe si pertinent), et
     comparer l'identifiant de version du pied de page à celui de la charte — s'il est
     inférieur, signaler l'écart et proposer la remise à niveau plutôt que de l'appliquer
     d'office.
   - **Deux encadrés `important`** juste après, toujours les deux mêmes règles, texte
     adaptable au projet : « détection de dérive » (A-5) et « validation avant écriture dans
     le journal et la roadmap » (A-3), cette seconde règle couvrant aussi les lignes d'état
     intermédiaires et les descriptions de design.
   - **`Quand mettre à jour`** : la cadence de chacun des autres documents — les deux
     cadences opposées d'A-3, avec l'exception « session qui s'éternise ». Terminer par un
     rappel explicite que les entrées déjà écrites du journal ne se modifient jamais.
   - Si le projet a une **discipline de test** (option `discipline-test`), une dernière
     sous-section qui la rappelle en une ou deux phrases.
6. **Pied de page** : nom du projet + date de la dernière restructuration de la gouvernance
   elle-même (pas la date du dernier chantier), suivie de **« Conforme à la charte de
   gouvernance, version {{id}} »**.

## `AI-CONTEXT` — invariants et pièges

Ordre après le `<h1>Contexte &amp; invariants</h1>` et la ligne de dernière revue :

1. **Paragraphe d'intro** : rappeler l'objectif — éviter de retomber deux fois dans le même
   piège, donc organisation **par catégorie thématique**, pas chronologique. Préciser
   explicitement que la numérotation `#N` est **stable et ne se renumérote jamais** (A-6),
   et que les commandes de build ne sont pas dupliquées ici (elles restent dans le fichier
   d'instructions).
2. **Encadré `note` « Légende »** expliquant la convention du statut « À revérifier ».
3. **`Sommaire`** : liste d'ancres vers chaque catégorie, chaque entrée listant les numéros
   `#N` qu'elle contient. Immédiatement dessous, une ligne secondaire donnant le **prochain
   numéro de piège libre** — sans elle, l'ajout d'un piège produit tôt ou tard une collision
   avec un numéro déjà attribué plus haut dans le fichier.
4. **Une section par catégorie**, dans un ordre stable. Catégories couramment utiles, toutes
   ne s'appliquant pas partout : identité du projet (nom, emplacements, identité Git) ;
   environnement et build ; architecture et composants du framework ; comment vérifier
   qu'une dépendance externe est réellement utilisable ; intégrité et persistance des
   données ; VCS ; debug et workflow de dev ; publication et distribution.
5. **Deux formats à l'intérieur d'une catégorie** :
   - **fait stable simple** : une puce, sans numéro (convention de nommage, version
     verrouillée, ou le pourquoi d'un chantier passé quand `journal-format = log` lui retire
     sa place dans le journal — voir § suivant) ;
   - **piège documenté** : un titre `#N — {{titre court}}` suivi d'un paragraphe décrivant
     **le symptôme, la cause, puis la solution** — dans cet ordre, un futur lecteur devant
     pouvoir reconnaître le symptôme avant de lire la solution. Bloc de code si une commande
     est nécessaire pour reproduire ou contourner, et **encadré `warning` séparé** si le
     piège a un effet de bord opérationnel au-delà de la cause immédiate.

## `AI-HISTORY` — journal chronologique par chantier

Ordre après le `<h1>Journal de bord</h1>` :

1. **Ligne secondaire** rappelant l'ordre de tri : chantiers du plus récent au plus ancien ;
   à l'intérieur d'un chantier, entrées les plus récentes en tête.
2. **Encadré `important`** répétant A-4 — ne jamais modifier une entrée existante, seulement
   en ajouter en tête du chantier concerné — et le format de ligne, selon l'option
   `journal-format` : `Date | Hash | Résumé` (`tableau`) ou `Date | Hash | Chantier | Résumé`
   (`log`).
3. **Une section par chantier**, titre au format `{{Nom du chantier}} ({{date de la dernière
   entrée}})`, suivie **optionnellement** d'un paragraphe de contexte quand le chantier a
   besoin d'être resitué (signalé par qui, pourquoi il a démarré).
4. **Un tableau par chantier**, colonnes `Date` / `Hash` / `Résumé`, une ligne par commit ou
   événement notable, triées de la plus récente à la plus ancienne. `Hash` suit strictement
   les trois valeurs d'A-4. Le résumé peut mettre en gras une décision actée au milieu d'une
   entrée plus longue.
5. Un chantier peut être un **diagnostic ponctuel** (bug signalé → cause trouvée →
   correctif), pas seulement une fonctionnalité — même format.

Si `documents = 3`, le journal et la roadmap partagent un fichier : le journal occupe la
première moitié, la roadmap la seconde, chacune gardant son plan ci-dessus et son propre
titre de niveau 1.

### Variante `log` (option `journal-format`)

Remplace les points 3 et 4 ci-dessus — points 1, 2 (adapté) et 5 inchangés :

- **Pas de section par chantier : un tableau unique** pour tout le journal, colonnes
  `Date` / `Hash` / `Chantier` / `Résumé`, triées de la plus récente à la plus ancienne
  entrée — `Chantier` est un champ de la ligne, pas un regroupement.
- **`Résumé` ≤ 250 caractères.** Pas de gras, pas de sous-parties : le fait acté, pas le
  récit. Un renvoi court entre crochets quand il compte vraiment — `[#N]` vers un piège du
  contexte, `[roadmap#slug]` vers un chantier de la roadmap — compté dans la borne.
- **Pas de paragraphe de contexte de chantier.** S'il compte encore, il vit comme fait
  stable dans `AI-CONTEXT` (§ précédent), pas ici.

## `ROADMAP` — statut et design des chantiers restants

Ordre après le `<h1>Roadmap</h1>` et la ligne de dernière revue :

1. **Paragraphe de renvoi** : ce qui est livré est dans le journal, les pièges et invariants
   du code en place sont dans le contexte — cette page ne répète ni l'un ni l'autre,
   uniquement ce qui reste à faire ou à décider.
2. **`Vue d'ensemble`** : tableau `Chantier` / `Statut` / `Priorité`, la colonne `Chantier`
   étant un lien d'ancre vers le détail plus bas. **Ces colonnes ne tiennent que tant que le
   détail vit sur la même page** : à l'éclatement (§ 6), le tableau devient un index de
   renvois et les perd.
3. **Sections de détail par groupe**, dans cet ordre stable : `Phase 1 — {{priorité}}`,
   `Phase 2 — {{priorité}}`, `Non daté — à faire quand utile`, `Hors périmètre`. N'inclure
   que les phases pertinentes, mais garder « Hors périmètre » en dernier dès que des idées
   ont été explicitement écartées — c'est ce qui évite qu'elles soient reproposées sans
   qu'on sache qu'elles ont déjà été tranchées. Si l'option `registre-livrés` vaut `oui`, un
   chantier arrivé à son état terminal n'a plus de section de détail ici : seule une ligne
   pointant vers `annexes/REALISE.{{ext}}` (§ 9) subsiste, à la position chronologique qu'il
   occupait.
4. **Un titre ancré par chantier** dans une phase, avec :
   - un paragraphe de design aussi détaillé que possible — les choix d'architecture et d'UX
     déjà tranchés, pas seulement une intention vague ;
   - une liste à puces des sous-décisions ou contraintes identifiées ;
   - une **ligne secondaire finale** si un point reste à vérifier au moment de
     l'implémentation — ce qui distingue le tranché de l'ouvert ;
   - un **encadré `important`** quand le chantier a été sorti du périmètre, ou quand une
     décision de scope a été actée après hésitation. L'encadré porte le *pourquoi*, pas
     seulement le *quoi*.

---

# 4. Feuille de style (`format = html`)

Un seul `style.css` par projet, à la racine de `.AIRules/`, atteint depuis les
sous-dossiers par `../style.css` — jamais recopié.

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6a6a6a;
  --border: #dcdcdc;
  --zebra: #f7f7f7;
  --accent: #2f6feb;
  --note-bg: #eef4ff;    --note-br: #2f6feb;
  --warn-bg: #fff6e5;    --warn-br: #d98324;
  --imp-bg:  #ffeeee;    --imp-br:  #d13b3b;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181c;
    --fg: #e6e6e6;
    --muted: #9aa0a6;
    --border: #33373d;
    --zebra: #1c1f24;
    --accent: #7aa7ff;
    --note-bg: #16233a;  --note-br: #4f86ff;
    --warn-bg: #33270f;  --warn-br: #e0a044;
    --imp-bg:  #35191a;  --imp-br:  #e05c5c;
  }
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}

a { color: var(--accent); }

.tabbar {
  display: flex;
  gap: .25rem;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
  padding-bottom: .5rem;
}
.tabbar a {
  padding: .35rem .75rem;
  border-radius: 6px;
  text-decoration: none;
}
.tabbar a:hover { background: var(--zebra); }
.tabbar a.current { background: var(--accent); color: #fff; }

h1 { margin-bottom: .25rem; }
h2 { margin-top: 2.5rem; border-bottom: 1px solid var(--border); padding-bottom: .25rem; }
h3 { margin-top: 1.75rem; }

.muted { color: var(--muted); font-size: .9rem; }

table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid var(--border); padding: .45rem .6rem; text-align: left; vertical-align: top; }
tbody tr:nth-child(odd) { background: var(--zebra); }

pre {
  background: var(--zebra);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: .75rem 1rem;
  overflow-x: auto;
}
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .9em; }
pre code { font-size: .85em; }

.callout {
  border-left: 4px solid var(--border);
  border-radius: 0 6px 6px 0;
  padding: .75rem 1rem;
  margin: 1.25rem 0;
}
.callout-title { font-weight: 700; margin: 0 0 .35rem; }
.callout p:last-child { margin-bottom: 0; }
.callout.note      { background: var(--note-bg); border-left-color: var(--note-br); }
.callout.warning   { background: var(--warn-bg); border-left-color: var(--warn-br); }
.callout.important { background: var(--imp-bg);  border-left-color: var(--imp-br); }

.pill {
  display: inline-block;
  padding: .1rem .5rem;
  border-radius: 999px;
  font-size: .85em;
  white-space: nowrap;
  border: 1px solid var(--border);
}
.pill.done     { background: #d6f5d6; color: #14571b; }
.pill.adopted  { background: #d8ecff; color: #0d3f6b; }
.pill.progress { background: #ffe9c7; color: #6b3f0d; }
.pill.planned  { background: #ececec; color: #3a3a3a; }
.pill.out      { background: #f0d5d5; color: #6b1414; }
.pill.warn     { background: #fff2b8; color: #6b5410; }

footer {
  margin-top: 4rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: .85rem;
}
```

Le thème suit celui du système via `prefers-color-scheme` — **pas de bascule JavaScript**,
le format n'en admet aucun.

---

# 5. Pages placées dans un sous-dossier (`annexes/`, `archive/`)

La navbar est **réservée aux documents principaux** : elle sert à identifier la gouvernance
elle-même. Une page d'annexe ou d'archive n'en a pas — elle se rattache par des hyperliens,
pas par une barre de navigation.

Squelette : celui du § 1 **sans le bloc de navigation**, avec :

- une **ligne secondaire juste sous le titre**, qui dit de quel document la page dépend et
  porte le lien de retour vers l'endroit exact qui la cite — par exemple « Annexe de
  [Roadmap → {{chantier}}](../ROADMAP.html#slug) ». C'est le seul chemin de retour, donc il
  est **obligatoire** : sans lui, une page atteinte par un signet ou une recherche est un
  cul-de-sac ;
- la feuille de style atteinte par le même mécanisme (`../style.css`), jamais recopiée dans
  le sous-dossier ;
- un pied de page identique à celui des documents principaux.

---

# 6. Éclatement d'un document principal

Quand un dépôt porte plusieurs applications ou composants livrables distincts, un document
principal — en pratique la roadmap, parfois le journal — cesse d'être lisible en un seul
fichier. Il peut être **éclaté** en pages de détail, une par périmètre, dans un sous-dossier
portant son nom (`roadmap/ROADMAP_{{app}}.html`).

- **Les documents principaux restent au même nombre.** Le document éclaté demeure à la
  racine de `.AIRules/`, garde sa place dans la navbar, et devient un **index de renvois**.
  Une page de détail suit le squelette du § 5 : pas de navbar, ligne de retour vers l'index.
- **Périmètres disjoints.** Un chantier appartient à une page de détail et une seule. Un
  chantier transverse reste sur l'index.
- **Un index de renvois ne porte aucun statut.** Quand le détail vit ailleurs, l'index n'en
  donne que le nom et le lien — jamais le statut, la priorité ni l'avancement, portés
  **exclusivement** par la page de détail. Deux pages qui décrivent le même fait divergent,
  et l'index est celle qu'on oublie. Maintenir ces colonnes suppose qu'elles soient
  **générées** depuis les pages de détail, jamais saisies à la main.
- **Dernier recours, pas réflexe d'organisation.** L'éclatement se déclenche quand le
  document dépasse ce qu'on relit d'un bout à l'autre, et se décide comme tout changement
  structurant (A-13).

---

# 7. `PROFIL.md` — gabarit

Toujours en Markdown, quel que soit le format du projet. Un fichier à la racine de
`.AIRules/`.

```markdown
# {{Nom du projet}} — Profil de gouvernance

Réponses de cadrage de ce projet. La charte qui les rend nécessaires est
[`GOUVERNANCE-IA.md`](./GOUVERNANCE-IA.md), partie B.

- **Profil de départ** : `standard`
- **Charte au moment du cadrage** : `{{id}}`
- **Dernière revue de ce profil** : {{date}}

## Choix

| Clé | Choix | Pourquoi |
|---|---|---|
| `format` | `html` | défaut appliqué, non tranché |
| `documents` | `4` | défaut appliqué, non tranché |
| `registre-livrés` | `oui` | défaut appliqué, non tranché |
| `journal-format` | `tableau` | défaut appliqué, non tranché |
| `fichier-instructions` | `CLAUDE.md` | défaut appliqué, non tranché |
| `statuts` | `complet` | défaut appliqué, non tranché |
| `outillage` | `oui` | le projet produit ses propres scripts de build et de publication |
| `tempfiles` | `oui` | défaut appliqué, non tranché |
| `distant` | `oui` | défaut appliqué, non tranché |
| `visibilité` | `public` | destiné à être publié dès le départ |
| `attribution` | {{oui ou non}} | {{motif — décision d'auteur, à trancher explicitement}} |
| `authentification` | {{compte}} via {{méthode}} | — |
| `branches` | `branche` | défaut appliqué, non tranché |
| `seuil` | `strict` | défaut appliqué, non tranché |
| `roadmap-avant-code` | `oui` | défaut appliqué, non tranché |
| `mot-cloture` | {{mot}} | ferme un chantier : documents, fichier d'instructions, commit, push |
| `mot-cadrage` | {{mot}} | rouvre l'entretien, complet ou ciblé |
| `validation` | {{ce que « conditions réelles » veut dire ici}} | — |
| `jetables` | {{convention de nommage}} | — |
| `test-manuel` | `oui` | défaut appliqué, non tranché |
| `support-test` | `8` | au-delà de 8 vérifications, passe sur document dédié |
| `dépendances` | `ordinaire` | défaut appliqué, non tranché |
| `discipline-test` | {{comment on teste, ce qui ne doit jamais être touché}} | — |
| `validateur` | {{outil et commande}} | commande exacte dans le fichier d'instructions |
| `veille-conformité` | `non` | défaut appliqué, non tranché |

## Questions non tranchées

Les lignes portant « défaut appliqué, non tranché » se reposent à la prochaine remise à
niveau. Elles ne sont pas des choix : elles sont l'absence de choix, rendue visible.

## Historique des changements

Un changement de ce fichier est un changement structurant : il se propose, se valide, et
laisse une ligne au journal. Le tableau ci-dessus porte la valeur courante ; le journal
porte l'histoire.
```

## Ce que posent les trois profils

Point de départ seulement — chaque ligne reste écrasable.

| Clé | `minimal` | `standard` | `complet` |
|---|---|---|---|
| `format` | `markdown` | `html` | `html` |
| `documents` | `3` | `4` | `4` |
| `registre-livrés` | `non` | `oui` | `oui` |
| `journal-format` | `tableau` | `tableau` | `log` |
| `fichier-instructions` | `CLAUDE.md` | `CLAUDE.md` | `CLAUDE.md` |
| `statuts` | `réduit` | `complet` | `complet` |
| `outillage` | `non` | à demander | `oui` |
| `tempfiles` | `oui` | `oui` | `oui` |
| `distant` | `oui` | `oui` | `oui` |
| `branches` | `direct` | `branche` | `branche` |
| `seuil` | `tout-libre` | `strict` | `strict` |
| `roadmap-avant-code` | `non` | `oui` | `oui` |
| `test-manuel` | `oui` | `oui` | `oui` |
| `support-test` | `prose` | `8` | `8` |
| `dépendances` | `ordinaire` | `ordinaire` | `ordinaire` |
| `veille-conformité` | `non` | `non` | `oui` |

Les neuf questions **sans défaut** — `visibilité`, `attribution`, `authentification`,
`validation`, `jetables`, `discipline-test`, `validateur`, `mot-cloture`, `mot-cadrage` — ne
figurent dans aucun profil. Elles se posent toujours, quel que soit le point de départ.

Les deux mots, en particulier, ne peuvent pas avoir de défaut : un mot qu'on n'a pas choisi
ne se retient pas, et un mot imposé finirait par se déclencher au fil d'une phrase.

---

# 8. Support de passe de test (option `support-test`)

Un document autonome, ouvert dans un navigateur, que l'utilisateur remplit à mesure qu'il
teste et dont il renvoie le rapport. Il vit **hors du dépôt** — dans l'espace de brouillons
du projet concerné si celui-ci en a un (option `tempfiles`) — se **réédite d'une passe à
la suivante**, et ne se supprime qu'à la consignation du chantier.

**À quoi il sert d'abord** : à ce qu'une longue passe soit menée jusqu'au bout. Au-delà
de quelques vérifications, l'obstacle n'est pas la précision mais l'endurance — plusieurs
dizaines de contrôles, étalés sur plusieurs séances, s'abandonnent en cours de route quand
rien ne montre le chemin parcouru. Tout ce qui suit découle de là ; le rapport n'est que
ce qu'on récolte une fois arrivé au bout.

Il ne suppose pas une interface graphique : une passe de vérifications en ligne de
commande, de contrôles de configuration ou d'étapes d'installation prend la même forme.

Ce gabarit existe pour une seconde raison : les oublis d'un support de passe sont
**invisibles depuis l'écran**. Une criticité affichée mais absente du rapport, une passe
sans version testée, un état qui confond « pas encore fait » et « sans objet » ne se
constatent qu'à la lecture du rapport, une fois la passe terminée et l'occasion passée.
C'est ce que le contrat de sortie verrouille.

## Ossature obligatoire

- **Trois repères de progression, qui se complètent** et ne se remplacent pas : le
  **nombre restant** (l'effort qui reste, en chiffres), une **proportion visuelle** (la
  fin qui approche), et l'**état visible de chaque ligne** (le chemin parcouru, en faisant
  défiler). Les trois **restent atteignables quelle que soit la position dans la page** :
  sur une passe longue, c'est ce qui distingue un effort borné d'un effort sans fin
  apparente.
- **Reprise sans perte** : les réponses déjà données se retrouvent à la réouverture,
  automatiquement. Une passe qui se mène en trois séances ne redemande rien.
- **En-tête de passe** : titre, **version ou révision testée**, date, et la liste des
  **préalables** (état de départ, redémarrage nécessaire, jeu de données jetables à
  employer — option `jetables`).
- **Tests groupés par vagues**, des fondations vers ce qui en dépend.
- **Un test = un numéro stable, une action, un attendu.** Les numéros ne se réattribuent
  jamais d'une passe à l'autre (A-6) : un test repris garde le sien.
- **Trois choix de résultat** : `ok`, `ko`, et le retour à l'absence de réponse. Le
  quatrième état, **non applicable**, ne prend pas de bouton : il **se déduit** d'un test
  sans réponse *et* commenté, le commentaire tenant lieu de raison. La distinction se paie
  au rapport, pas sur chaque ligne.
- **Un champ de commentaire par test**, atteignable même quand le test réussit. Derrière
  un bouton convient ; ce qui compte est qu'il existe sur un test vert.
- **Rapport copiable en un geste**, conforme au contrat ci-dessous.

Le reste de la présentation est libre — elle doit seulement rester lisible en thème clair
comme en thème sombre, et l'état de chaque test doit se voir sans le lire.

## Structure des données

Tout ce qui change d'une passe à l'autre tient dans ces deux déclarations, en tête du
script : c'est ce qu'on réécrit, le reste ne bouge pas.

```js
const PASSE = {
  titre:     "{{ce que cette passe couvre}}",
  version:   "{{révision, build ou commit testé}}",   // sans lui, le rapport ne prouve rien
  date:      "{{AAAA-MM-JJ}}",
  prealables: [
    "{{état de départ attendu}}",
    "{{redémarrage ou réinstallation nécessaire}}",
    "{{convention de données jetables — option jetables}}"
  ]
}

const VAGUES = [
  { titre: "{{fondations}}", tests: [
    { n: 1, action: "{{ce qu'on fait, sans ambiguïté}}",
             attendu: "{{ce qu'on doit voir — et si possible ce que ça discrimine}}",
             cle: "{{pourquoi son échec invalide la suite}}" },   // `cle` facultatif
    { n: 2, action: "{{…}}", attendu: "{{…}}" }
  ]},
  { titre: "{{ce qui en dépend}}", tests: [ /* … */ ] }
]
```

## Contrat de sortie du rapport

C'est la seule partie qui quitte le poste de travail. Ce qui n'y figure pas n'existe pas
pour qui le lit — d'où la forme imposée :

```
{{titre}} — {{date}} · version {{version}}
{{n}} ok · {{n}} échecs · {{n}} non applicables · {{n}} non testés

/!\ Test clé en échec : la suite de la passe ne conclut rien.   (ligne présente seulement si c'est le cas)

## Échecs
- [12] (vague « {{titre}} ») [CLÉ] {{action}}
       attendu : {{attendu}}
       {{commentaire, si présent}}

## Remarques
- [15] {{action}}
       {{commentaire}}

## Non applicables
- [18] {{raison}}

## Non testés
20, 21, 22
```

Cinq exigences derrière cette forme :

1. **La vague et la marque `[CLÉ]` accompagnent chaque échec.** Sans elles, un échec qui
   invalide tout le reste se lit comme un échec mineur.
2. **La ligne d'avertissement en tête** quand un test clé a échoué : elle dit que les
   résultats suivants ne concluent rien, ce que le lecteur ne peut pas deviner.
3. **Les remarques sortent même quand le test réussit.** C'est la raison d'être du champ
   de commentaire ; les omettre revient à n'avoir que des cases.
4. **Non testé et non applicable sont deux rubriques distinctes**, la seconde portant
   toujours une raison — celle qu'a saisie le commentaire, puisque l'état s'en déduit. Les
   fondre rend un oubli indiscernable d'un choix, ce qu'A-4 tranche déjà pour la colonne
   `Hash`.
5. **Ce qui a réussi ne se liste pas** : le silence vaut réussite. Énumérer les tests
   verts noierait les quelques lignes qui comptent — et c'est l'en-tête, avec sa date et sa
   version testée, qui empêche ce silence d'être ambigu.

## Deux pièges d'implémentation

> **⚠️ La clé de sauvegarde locale doit changer avec la passe**
>
> Une clé fixe fait ressurgir les réponses de la passe précédente sur les tests qui gardent
> leur numéro — et elles s'affichent comme des réponses de la passe en cours. La dériver de
> la date et de la liste des numéros plutôt que de l'incrémenter à la main : un compteur
> qu'on oublie d'incrémenter ne prévient pas.

> **⚠️ Le presse-papier asynchrone est souvent refusé depuis un fichier local**
>
> Prévoir un repli : sélectionner le contenu du rapport et le laisser copiable au clavier,
> avec un message qui dit lequel des deux chemins a fonctionné. Un bouton « copier » qui
> échoue en silence fait croire à un rapport copié.

---

# 9. Registre des chantiers livrés (option `registre-livrés`)

Annexe (A-8) qui reçoit un chantier dès qu'il atteint son état terminal (`Livré`, ou
`Adopté` pour l'outillage). Fichier `annexes/REALISE.{{ext}}`, suit le squelette de pages
d'annexe du § 5 — pas de navbar, ligne de retour vers `ROADMAP.{{ext}}`.

## Plan

1. **Ligne de retour** (§ 5) vers la roadmap active.
2. **Paragraphe de renvoi** : ce registre ne porte que l'état d'un chantier déjà livré ; ce
   qui reste à faire est dans la roadmap active, l'événement daté est dans le journal.
3. **Une section par chantier, la plus récente en tête** — l'inverse de l'ordre du journal :
   un lecteur qui ouvre ce fichier cherche d'abord ce qui vient d'être livré. Titre ancré,
   identifiant stable (A-6).
4. **Une entrée porte, dans cet ordre** :
   - le design retenu et l'ampleur du chantier, repris depuis la roadmap au moment de la
     bascule — pas réécrit ;
   - le renvoi vers l'entrée du journal qui l'a acté ;
   - les évolutions post-livraison, une ligne chacune (ajout, retrait, remplacement), datées
     par rapport à la livraison. Une ligne se limite au changement lui-même ; le récit du
     pourquoi et du comment reste au journal, que la ligne renvoie sans le répéter. Une
     évolution qui touche l'architecture, une convention ou plus d'un fichier rouvre un
     chantier dans l'actif au lieu de s'ajouter ici (seuil de l'option
     `roadmap-avant-code`) ;
   - les numéros de pièges issus du chantier, sans les réexpliquer (A-2, le contexte les
     porte) ;
   - la liste des commits du chantier, en une seule ligne, en ordre chronologique — seule
     information de l'entrée qu'aucun autre document ne porte.

## Bascule

- Un chantier `Écarté` ne bascule jamais : il reste en « Hors périmètre » dans la roadmap
  active.
- La roadmap active ne garde du chantier livré qu'**une ligne et son lien** vers l'entrée du
  registre — jamais son statut ni son détail en double (A-2).
- Indépendant de l'option `documents` : registre ou pas, la roadmap et le journal restent
  scindés ou fusionnés selon cette option-là. Le registre est une annexe, pas un cinquième
  document principal, et n'entre jamais dans la navbar.

> **⚠️ Une réécriture d'historique invalide la ligne de commits, en silence**
>
> `rebase`, `filter-branch` ou une amende massive changent les hashes sans que la ligne
> cesse d'être lisible — elle continue de désigner des commits qui n'existent plus. Toute
> réécriture d'historique impose de rejouer les lignes de commits du registre touchées, ou
> d'y porter une table de correspondance, le même geste qu'A-4 prévoit pour le journal.

---
*Version de ce fichier : **`20260804-071239`**. Il suit l'identifiant de
[`GOUVERNANCE-IA.md`](./GOUVERNANCE-IA.md) et se propage avec elle.*
