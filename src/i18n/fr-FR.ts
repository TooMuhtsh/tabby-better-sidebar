/**
 * French table — keys are the English source strings used in the code,
 * CHARACTER FOR CHARACTER: a key that no longer matches its source raises no
 * error, the sentence silently falls back to English. `npm run lint:i18n`
 * makes that drift visible — run it after every change here.
 *
 * ICU TRAP (measured on the vault): these strings go through
 * `TranslateMessageFormatCompiler`, for which a straight apostrophe is an
 * escape character when it touches a brace. `jusqu'{date}` is swallowed;
 * `jusqu'au {date}` is fine. Never glue an apostrophe to a parameter —
 * reword. French triggers this naturally; the linter flags it.
 *
 * Filled during the i18n conversion chantier, one batch of files at a time:
 * every English string introduced in the code lands here (and in es-ES /
 * de-DE) in the same change, so the tables never trail the code. French is
 * a translation like the others even though the plugin was born French —
 * the source of truth in the code is the English string, and the French
 * value must reproduce the pre-i18n UI text exactly (a French user must see
 * zero change).
 */
const fr_FR: Record<string, string> = {
    // sftpPanel.component.ts — header line, auto-return-to-Profiles notices
    'SSH session lost ({tab}) — back to Profiles view': 'Session SSH perdue ({tab}) — retour sur la vue Profils',
    'SSH session lost — back to Profiles view': 'Session SSH perdue — retour sur la vue Profils',
    'No more active SSH session — back to Profiles view': 'Plus aucune session SSH active — retour sur la vue Profils',

    // sftpPanel.component.pug — freeze toggle, waiting placeholder
    'Frozen view — click to follow focus again': 'Vue figée — cliquer pour suivre à nouveau le focus',
    'Freeze view on this session': 'Figer la vue sur cette session',
    'Waiting for an active SSH session.': 'En attente d\'une session SSH active.',
    'Open an SSH profile — the panel will follow the selected tab.': 'Ouvrez un profil SSH — le panneau suivra l\'onglet sélectionné.',

    // sftpBrowser.component.ts — AVAILABLE_COLUMNS / DISPLAY_TOGGLES
    'Size': 'Taille',
    'File size': 'Taille du fichier',
    'Date': 'Date',
    'Date modified': 'Date de modification',
    'Perm.': 'Perm.',
    'Permissions in octal (755)': 'Permissions en octal (755)',
    'Rights': 'Droits',
    'Permissions in long form (drwxr-xr-x)': 'Permissions en format long (drwxr-xr-x)',
    'Type': 'Type',
    'Item type': 'Nature de l’élément',
    'Ext.': 'Ext.',
    'File extension': 'Extension du fichier',
    'Folders first': 'Dossiers en premier',
    'Show hidden files': 'Afficher les fichiers cachés',
    'Column borders': 'Bordures de colonnes',
    'Alternating rows': 'Lignes alternées',

    // sftpBrowser.component.ts — downloadFolder()
    'Destination folder for {name}': 'Dossier de destination pour {name}',
    'Download here': 'Télécharger ici',
    '{name} downloaded to {base}': '{name} téléchargé dans {base}',
    '{name}: incomplete download': '{name} : téléchargement incomplet',

    // sftpBrowser.component.ts — createFileFromMenu()
    'New file name': 'Nom du nouveau fichier',
    'The name cannot contain "/"': 'Le nom ne peut pas contenir de « / »',
    '{name} already exists': '{name} existe déjà',
    'Could not create {name}': 'Impossible de créer {name}',

    // sftpBrowser.component.ts — openEntry()
    'Could not follow the link {name}': 'Impossible de suivre le lien {name}',
    '{name} points to a target that cannot be found': '{name} pointe vers une cible introuvable',
    '{name} → {target}': '{name} → {target}',

    // sftpBrowser.component.ts — confirmHeavyDirectory()
    'Could not read the contents of {name}': 'Impossible de lire le contenu de {name}',
    '"{name}" contains more than {count} files ({size} at least). Everything will be downloaded before drag-and-drop becomes possible, with no progress and no way to cancel. Continue?':
        '"{name}" contient plus de {count} fichiers ({size} au moins). Tout sera téléchargé avant que le glisser-déposer ne devienne possible, sans progression ni annulation. Continuer ?',
    'Download': 'Télécharger',

    // sftpBrowser.component.ts — receiveDrop() / resolveDestination()
    'Could not read what was dropped': 'Impossible de lire ce qui a été déposé',
    '{name} is not a folder — nothing was moved': '{name} n’est pas un dossier — rien n’a été déplacé',
    '{name} is not a folder — sending to {path}': '{name} n’est pas un dossier — envoi dans {path}',

    // sftpBrowser.component.ts — confirmOverwrite()
    '{names}, and {rest, plural, one {# more} other {# more}}': '{names}, et {rest, plural, one {# autre} other {# autres}}',
    '{count} files already exist under {destination} and will be overwritten: {list}. Continue?':
        '{count} fichiers existent déjà sous {destination} et seront écrasés : {list}. Continuer ?',
    'A file already exists under {destination} and will be overwritten: {list}. Continue?':
        'Un fichier existe déjà sous {destination} et sera écrasé : {list}. Continuer ?',
    'Overwrite': 'Écraser',

    // sftpBrowser.component.ts — reportDrop()
    // Each plural agreement is written as a full inflected word ("envoyé" /
    // "envoyés") rather than a bare suffix ("" / "s"): a bare ASCII suffix
    // inside its own {…} would look exactly like an ICU placeholder to the
    // lexical param check in `lint:i18n`, and get flagged as an invented one
    // ("s") the English source never declares. The accented word sidesteps
    // that false positive (its extra letters break the plain \w+ match) and
    // reads the same either way.
    '{sent, plural, one {# file} other {# files}} sent to {destination} ({folders, plural, one {# folder} other {# folders}})':
        '{sent, plural, one {# fichier} other {# fichiers}} {sent, plural, one {envoyé} other {envoyés}} vers {destination} ({folders, plural, one {# dossier} other {# dossiers}})',
    '{sent, plural, one {# file} other {# files}} sent to {destination}':
        '{sent, plural, one {# fichier} other {# fichiers}} {sent, plural, one {envoyé} other {envoyés}} vers {destination}',
    '{folders, plural, one {# folder} other {# folders}} created in {destination}':
        '{folders, plural, one {# dossier} other {# dossiers}} {folders, plural, one {créé} other {créés}} dans {destination}',
    // Reformulated: the original French negation ("ne...pas") inflects with
    // the same `failed` count that feeds the plural block, which would have
    // glued a straight apostrophe to a `{failed, plural, ...}` brace (the
    // ICU escape trap) — reworded around it rather than risking the swallow.
    'Could not send {failed, plural, one {# file} other {# files}} of {total}':
        'Envoi impossible pour {failed, plural, one {# fichier} other {# fichiers}} sur {total}',

    // sftpBrowser.component.ts — askedToLeave()
    'Dragging folders out is disabled — enable it in Settings → Better Sidebar':
        'Le glisser-déposer des dossiers vers l’extérieur est désactivé — activez-le dans Paramètres → Better Sidebar',

    // sftpBrowser.component.ts — receiveMove()
    '{name} cannot be moved into itself': '{name} ne peut pas être déplacé dans lui-même',
    '{name} already exists in {destination}': '{name} existe déjà dans {destination}',
    'Could not move {name}: {error}': 'Impossible de déplacer {name} : {error}',
    '{name} moved to {destination}': '{name} déplacé vers {destination}',
    'Could not move {name} to {destination}': 'Impossible de déplacer {name} vers {destination}',
    '{count} items moved to {destination}': '{count} éléments déplacés vers {destination}',
    'No move succeeded': 'Aucun déplacement n’a abouti',
    '{succeeded} moved, {failed} failed': '{succeeded} déplacés, {failed} en échec',

    // sftpBrowser.component.ts — showContextMenu()
    'Open with...': 'Ouvrir avec...',
    'Rename...': 'Renommer...',
    'Delete': 'Supprimer',
    'Delete selection ({count})': 'Supprimer la sélection ({count})',

    // sftpBrowser.component.ts — renameEntry()
    'New name for "{name}"': 'Nouveau nom de « {name} »',
    'The name cannot contain "/" — this renames, it does not move': 'Le nom ne peut pas contenir de « / » — ceci renomme, cela ne déplace pas',
    '{name} already exists in this folder': '{name} existe déjà dans ce dossier',
    'Could not rename {name}': 'Impossible de renommer {name}',
    '{old} renamed to {new}': '{old} renommé en {new}',

    // sftpBrowser.component.ts — delete confirmations (single + bulk)
    'Delete folder "{name}" and everything in it?': 'Supprimer le dossier "{name}" et tout son contenu ?',
    // English source reworded to dodge an exact-string collision with a
    // Tabby msgid (`lint:i18n` reported ÉCRASE TABBY): the native "Delete
    // "{name}"?" carries a stray space before its closing quote in French,
    // and merging our value over it would have replaced that wording
    // app-wide. The French value below is unaffected — same text as before.
    'Confirm deletion of "{name}"?': 'Supprimer "{name}" ?',
    '{name} deleted': '{name} supprimé',
    'Could not delete {name}': 'Impossible de supprimer {name}',
    'Delete {count} items? This action is irreversible.': 'Supprimer {count} éléments ? Cette action est irréversible.',
    '{name}: {error}': '{name} : {error}',
    '{count} items deleted': '{count} éléments supprimés',
    '{succeeded} deleted, {failed} failed': '{succeeded} supprimés, {failed} en échec',

    // sftpBrowser.component.ts — typeLabel() / rowTooltip()
    'Link': 'Lien',
    'Folder': 'Dossier',
    'File': 'Fichier',
    'Size: {size} ({bytes} bytes)': 'Taille : {size} ({bytes} octets)',
    'Modified: {date}': 'Modifié : {date}',
    'Permissions: {octal} — {long}': 'Permissions : {octal} — {long}',
    'Type: {type}': 'Type : {type}',
    'Symbolic link': 'Lien symbolique',

    // sftpBrowser.component.pug — toolbar
    'Double-click to type a path': 'Double-cliquer pour saisir un chemin',
    'Type the path by hand': 'Saisir le chemin à la main',
    'Refresh': 'Actualiser',
    'Filter the list': 'Filtrer la liste',
    'New remote folder': 'Nouveau dossier distant',
    'Send files to the server': 'Envoyer des fichiers vers le serveur',
    'Send a folder to the server': 'Envoyer un dossier vers le serveur',
    'Filter...': 'Filtrer...',
    'Clear the filter': 'Effacer le filtre',

    // sftpBrowser.component.pug — body, grid, sentinel
    'Connecting...': 'Connexion...',
    'Loading...': 'Chargement...',
    'Name': 'Nom',
    'Go up one level': 'Remonter d’un niveau',
    '… {n} more items': '… encore {n} éléments',
    'No file matches the filter.': 'Aucun fichier ne correspond au filtre.',

    // sftpBrowser.component.pug — floating menus
    'Create a folder': 'Créer un dossier',
    'Create a file': 'Créer un fichier',
    'Display settings': 'Paramètres d’affichage',
    'Columns': 'Colonnes',

    // confirmModal.component.ts/.pug
    'Confirm': 'Confirmer',
    'Cancel': 'Annuler',

    // noteModal.component.pug
    'Note: {name}': 'Note — {name}',
    'Restart commands, maintenance reminders, ticket numbers…': 'Commandes de relance, rappels de maintenance, numéros de tickets…',
    'Clearing the field removes the note.': 'Vider le champ retire la note.',
    'Save': 'Enregistrer',

    // pasteGroupModal.component.ts/.pug
    'Paste the folder: {name}': 'Coller le groupe — {name}',
    'A folder named <strong>{name}</strong> already exists at the root.': 'Un dossier nommé <strong>{name}</strong> existe déjà à la racine.',
    'To paste: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'À coller : {folders, plural, one {# dossier} other {# dossiers}}, {profiles, plural, one {# profil} other {# profils}}.',
    'Removed from the export: {info}. Re-enter after pasting.': 'Retiré à l\'export : {info}. À ressaisir après le collage.',
    'Paste alongside': 'Coller à côté',
    'A new folder "{name}". Nothing existing is touched.': 'Un nouveau dossier « {name} ». Rien de ce qui existe n\'est touché.',
    'Merge into the existing folder': 'Fusionner dans le dossier existant',
    'Profiles and subfolders added to "{name}". Duplicates are not detected.': 'Profils et sous-dossiers ajoutés à « {name} ». Les doublons ne sont pas détectés.',

    // snippetsModal.component.pug
    'Snippets: {name}': 'Snippets — {name}',
    'No snippets.': 'Aucun snippet.',
    'Variables and behaviour of this snippet here': 'Variables et comportement de ce snippet ici',
    'Remove from here: stays in the library': 'Retirer d\'ici — reste dans la bibliothèque',
    'Detach': 'Détacher',
    'Variables': 'Variables',
    'Required, not filled in.': 'Obligatoire, non renseignée.',
    '"{value}" contains a space and is not quoted. Write "{token}" in the command, or quote the value here.':
        '« {value} » contient un espace et n\'est pas entre guillemets. Écrire "{token}" dans la commande, ou entourer la valeur ici.',
    'Behaviour': 'Comportement',
    'On click': 'Au clic',
    'Follow (run)': 'Suivre (exécuter)',
    'Follow (write)': 'Suivre (écrire)',
    'Write without confirming': 'Écrire sans valider',
    'Write and run': 'Écrire et exécuter',
    'Without a session': 'Sans session',
    'Follow (launch)': 'Suivre (lancer)',
    'Follow (do nothing)': 'Suivre (ne rien faire)',
    'Do nothing': 'Ne rien faire',
    'Launch the session': 'Lancer la session',
    'Wait': 'Attente',
    'to fill in': 'à renseigner',
    'follow': 'suivre',
    'Inherited': 'Hérités',
    'Reactivate here': 'Réactiver ici',
    'No longer offer here: stays attached to the folder': 'Ne plus proposer ici — reste rattaché au dossier',
    'Reactivate': 'Réactiver',
    'Disable here': 'Désactiver ici',
    'Available snippets': 'Snippets disponibles',
    'Attach here': 'Rattacher ici',
    'Attach': 'Rattacher',
    'Inherit (run)': 'Hériter (exécuter)',
    'Inherit (write)': 'Hériter (écrire)',
    'Inherit (launch)': 'Hériter (lancer)',
    'Inherit (do nothing)': 'Hériter (ne rien faire)',
    'Inherited from the content of the folder.': 'Hérités par le contenu du dossier.',
    'Manage the library': 'Gérer la bibliothèque',
    'Close': 'Fermer',

}

export default fr_FR
