# Typings de `tabby-ssh` — copie vendorisée

Copiés depuis l'application Tabby **installée**, pas depuis npm :

```
C:\Program Files\Tabby\resources\builtin-plugins\tabby-ssh\typings\
```

Version d'origine : Tabby **1.0.238** (le `package.json` du plugin intégré affiche toujours
`1.0.231-nightly.0` : Tabby ne le fait pas suivre), copié le 2026-10-09. Copie précédente : Tabby
1.0.231, le 2026-07-29. Écart de cette recopie : `cwd`, `rememberCwd` et `term` dans les options SSH,
`getRecoveryToken()` avec options sur l'onglet SSH, méthodes rendues asynchrones dans la modale de
redirection de ports, constructeur des réglages de profil SSH, et deux fichiers nouveaux
(`session/authMethodSelection`, `session/shellChannel`) ; rien de ce que le plugin consomme.

## Pourquoi vendoriser plutôt que dépendre du paquet npm

Deux raisons distinctes, les deux vérifiées sur place (voir `.AIRules/AI-CONTEXT.html`,
pièges #32 et #34) :

1. **Le chargeur de plugins de Tabby ne met pas `tabby-ssh` en cache.** Sa liste
   `builtinModules` ne contient que `tabby-core`, `tabby-local`, `tabby-settings` et
   `tabby-terminal`. Tout autre `tabby-*` passe par la résolution Node normale, qui trouve
   d'abord le `node_modules/` du plugin qui importe. Avoir `tabby-ssh` en dépendance faisait
   donc charger **une seconde copie** du module : classes homonymes mais distinctes,
   `instanceof` systématiquement faux, et un `SFTPPanelComponent` dont le `SSHModule` n'a
   jamais été bootstrappé par Angular. Sans copie locale, la résolution retombe sur
   `builtin-plugins/` — le vrai module, en dev comme en prod.

2. **Les typings npm sont en retard sur l'app installée à numéro de version identique**
   (piège #32). Compiler contre la copie installée, c'est compiler contre ce qui tourne.

## À faire après une mise à jour de Tabby

Recopier le dossier et vérifier ce qui a bougé :

```bash
diff -r "/c/Program Files/Tabby/resources/builtin-plugins/tabby-ssh/typings" src/types/tabby-ssh
```

(`PROVENANCE.md` ressortira comme seul fichier en trop, c'est normal.)

**Ne jamais réinstaller `tabby-ssh` dans `devDependencies`** : ça réintroduit la double copie
décrite au point 1, et le symptôme — « en attente d'une session SSH active » alors qu'une
session est bien ouverte — ne dit rien de sa cause.
