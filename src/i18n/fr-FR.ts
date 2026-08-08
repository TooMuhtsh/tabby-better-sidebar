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

    // transfers.component.pug — header, per-row states and tooltips (lot 3)
    'Transfers': 'Transferts',
    'Clear the list — running transfers will be cancelled': 'Vider la liste — les transferts en cours seront annulés',
    'Transfer finished — the system is still placing the file at its destination. The shown duration is an estimate: nothing signals when this copy ends.': 'Transfert terminé — le système finit de placer le fichier à destination. La durée est estimée : rien ne signale la fin de cette copie.',
    'handing over to the system…': 'remise au système…',
    'cancelled': 'annulé',
    'interrupted at {percent} %': 'interrompu à {percent} %',
    'incomplete at destination': 'incomplet à destination',
    'Estimated time remaining': 'Temps restant estimé',
    'Elapsed time': 'Temps écoulé',
    'Cancel this transfer and remove it': 'Annuler ce transfert et le retirer',
    'Remove from the list': 'Retirer de la liste',

    // transfers.component.ts — confirmations
    'Cancel "{name}" while it is running?': 'Annuler « {name} » en cours ?',
    'Cancel the transfer': 'Annuler le transfert',
    'One transfer is still running. Clearing the list will cancel it. Continue?': 'Un transfert est encore en cours. Vider la liste l\'annulera. Continuer ?',
    '{count} transfers are still running. Clearing the list will cancel them. Continue?': '{count} transferts sont encore en cours. Vider la liste les annulera. Continuer ?',
    'Clear and cancel': 'Vider et annuler',

    // transfersRegistry.service.ts — badge, breakdown tooltip, row tooltip
    'Session: {label}': 'Session : {label}',
    '{count} running': '{count} en cours',
    '{count, plural, one {# finished} other {# finished}}': '{count, plural, one {# terminé} other {# terminés}}',
    '{count, plural, one {# cancelled} other {# cancelled}}': '{count, plural, one {# annulé} other {# annulés}}',
    '{count, plural, one {# interrupted} other {# interrupted}}': '{count, plural, one {# interrompu} other {# interrompus}}',
    '{count, plural, one {# incomplete at destination} other {# incomplete at destination}}': '{count, plural, one {# incomplet à destination} other {# incomplets à destination}}',

    // sidebarTree.component.pug — view tabs, live sessions, recents, tunnels (lot 3)
    'Profiles': 'Profils',
    'SFTP of the active session': 'SFTP de la session active',
    'Active sessions': 'Sessions actives',
    'Open the SFTP of this session': 'Ouvrir le SFTP de cette session',
    // Key reworded from the natural "Recent": Tabby already owns that msgid
    // with a different French value ("Récent"), and merging ours over it
    // would rename it app-wide (ÉCRASE TABBY in lint:i18n). Same for
    // "Modify"/"Erase" below, dodging Tabby's "Edit" and "Clear".
    'Recently launched': 'Récents',
    'Active tunnels': 'Tunnels actifs',
    'resuming…': 'reprise…',
    'not restored': 'non remonté',
    'Open {url} in the browser': 'Ouvrir {url} dans le navigateur',
    'Go to the session': 'Aller à la session',

    // sidebarTree.component.pug — workspace bar, filter, selection, hidden items
    'All': 'Tous',
    'New workspace': 'Nouveau workspace',
    'Filter (Ctrl+F)': 'Filtrer (Ctrl+F)',
    'Hidden items in this workspace': 'Éléments masqués dans ce workspace',
    '{count, plural, one {# profile selected} other {# profiles selected}}': '{count, plural, one {# profil sélectionné} other {# profils sélectionnés}}',
    'Clear the selection': 'Annuler la sélection',
    'Drag the selection, or right-click the destination folder': 'Glissez la sélection, ou clic droit sur le dossier de destination',
    'No hidden items in this workspace.': 'Aucun élément masqué dans ce workspace.',
    'Show again': 'Réafficher',

    // sidebarTree.component.pug — profile row badges
    'Connected': 'Connecté',
    'Disconnected': 'Déconnecté',
    'No session': 'Aucune session',
    '{count} tunnel(s) mounted on this session': '{count} tunnel(s) monté(s) sur cette session',
    '{count} tunnel(s) configured: mounted when the session launches': '{count} tunnel(s) configuré(s) — montés au lancement de la session',
    'Upload in progress': 'Envoi en cours',
    'Download in progress': 'Réception en cours',

    // sidebarTree.component.pug — context menus
    'Move the selection here ({count})': 'Déplacer la sélection ici ({count})',
    'Launch all sessions': 'Lancer toutes les sessions',
    'Edit the note...': 'Modifier la note...',
    'Add a note...': 'Ajouter une note...',
    'Remove from favorites': 'Retirer des favoris',
    'Add to favorites': 'Ajouter aux favoris',
    'New folder...': 'Nouveau dossier...',
    'New profile...': 'Nouveau profil...',
    'Change the icon...': 'Changer l\'icône...',
    'Copy the structure (JSON)': 'Copier la structure (JSON)',
    'Copy without credentials': 'Copier sans les identifiants',
    'Hide in this workspace': 'Cacher dans le workspace',
    'Paste the folder': 'Coller le groupe',
    'Profile tunnels...': 'Tunnels du profil...',
    'Edit...': 'Éditer...',
    'Duplicate': 'Dupliquer',

    // sidebarTree.component.pug — icon picker
    'Choose an icon': 'Choisir une icône',
    'Remove the icon': 'Retirer l\'icône',
    'Favorites': 'Favoris',
    'Right-click an icon: "Add to favorites"': 'Clic droit sur une icône → « Ajouter aux favoris »',
    'Recently used': 'Récentes',
    'Search (e.g. server, folder, star...)': 'Rechercher (ex: server, folder, star...)',
    'Import from an SVG...': 'Importer à partir d\'un SVG...',
    'Apply the SVG': 'Appliquer le SVG',

    // sidebarTree.component.pug — rename/create popups
    'Rename': 'Renommer',
    'New folder': 'Nouveau dossier',
    'Folder name': 'Nom du dossier',
    'Create': 'Créer',

    // sidebarTree.component.pug — profile tunnels popup
    'Tunnels: {name}': 'Tunnels — {name}',
    'No tunnels configured on this profile.': 'Aucun tunnel configuré sur ce profil.',
    'Double-click to edit this tunnel': 'Double-cliquez pour modifier ce tunnel',
    'Delete this tunnel': 'Supprimer ce tunnel',
    'This tunnel is currently mounted on the open session. Deleting it here would remove its configuration without cutting the tunnel, which would keep running until the session closes. Close the session to be able to delete it.':
        'Ce tunnel est actuellement monté sur la session ouverte. Le supprimer ici retirerait sa configuration sans couper le tunnel, qui continuerait de tourner jusqu\'à la fermeture de la session. Fermez la session pour pouvoir le supprimer.',
    'Listening port': 'Port d\'écoute',
    'Target host': 'Hôte cible',
    'Target port': 'Port cible',
    'Description (optional)': 'Description (optionnel)',
    'Add the tunnel': 'Ajouter le tunnel',
    'Takes effect at the next session launch.': 'Prend effet au prochain lancement de la session.',

    // sidebarTree.component.pug — profile/workspace popups, footer
    'New profile': 'Nouveau profil',
    'Delete the profile': 'Supprimer le profil',
    'Delete "{name}"? This action is irreversible.': 'Supprimer « {name} » ? Cette action est irréversible.',
    'Icon...': 'Icône...',
    'Color...': 'Couleur...',
    'Copy (JSON)': 'Copier (JSON)',
    'Manage this workspace': 'Gérer ce workspace',
    'New workspace...': 'Nouveau workspace...',
    'Workspace name': 'Nom du workspace',
    'Import from the clipboard': 'Importer du presse-papiers',
    'Rename the workspace': 'Renommer le workspace',
    'Workspace color': 'Couleur du workspace',
    'Remove the color': 'Retirer la couleur',
    'Delete the workspace': 'Supprimer le workspace',
    'Delete "{name}"? Hidden profiles and folders become visible everywhere else. This action is irreversible.':
        'Supprimer « {name} » ? Les profils et dossiers masqués redeviennent visibles partout ailleurs. Cette action est irréversible.',
    'Better Sidebar settings': 'Réglages de Better Sidebar',

    // sidebarTree.component.ts — snippets notices, workspaces, pinned group
    'Variables to fill in on "{name}"': 'Variables à renseigner sur « {name} »',
    '{detail}: right-click the profile, "Snippets", then the snippet settings button.': '{detail} — clic droit sur le profil, « Snippets… », puis le bouton de réglages du snippet.',
    'This folder contains no profile to launch': 'Ce dossier ne contient aucun profil à lancer',
    'The clipboard does not hold an exported workspace.': 'Le presse-papiers ne contient pas un workspace exporté.',
    'Imported workspace': 'Workspace importé',
    'Workspace "{name}" imported.': 'Workspace « {name} » importé.',
    'Workspace "{name}" copied.': 'Workspace « {name} » copié.',
    'Pinned': 'Épinglés',
    '"{name}" expects a value': '« {name} » attend une valeur',
    '{list}: to fill in under "Snippets".': '{list} — à renseigner dans « Snippets… ».',
    '"{name}" has no open session': '« {name} » n\'a pas de session ouverte',
    'The session of "{name}" did not open': 'La session de « {name} » ne s\'est pas ouverte',

    // sidebarTree.component.ts — session tooltips, uptime units (only the day unit varies)
    'Transfers: {count} running, total speed {speed}': 'Transferts : {count} en cours, vitesse totale {speed}',
    'Transfers: {count} running': 'Transferts : {count} en cours',
    '{d}d {h}h': '{d}j {h}h',
    '{d} d {h} h': '{d} j {h} h',

    // sidebarTree.component.ts — tunnels (rows, hints, editor)
    '{detail}: session cut, tunnel waiting to resume': '{detail} — session coupée, tunnel en attente de reprise',
    '{detail}: not restored after the reconnection. Only the tunnels saved in the profile are remounted; a tunnel added on the fly disappears with its session.':
        '{detail} — non remonté après la reconnexion. Seuls les tunnels enregistrés dans le profil sont remontés ; un tunnel ajouté à la volée disparaît avec la session.',
    'Tunnel {detail} already mounted by {owner}: duplicate dismounted ({session})': 'Tunnel {detail} déjà monté par {owner} — doublon démonté ({session})',
    'Listens on the remote server. The destination is resolved from your PC.': 'Écoute sur le serveur distant. La destination est résolue depuis votre PC.',
    'Opens a SOCKS proxy on your PC, with no fixed destination.': 'Ouvre un proxy SOCKS sur votre PC, sans destination fixe.',
    'Listens on your PC. The destination is resolved from the server, so "localhost" there means the server.':
        'Écoute sur votre PC. La destination est résolue depuis le serveur — « localhost » y désigne donc le serveur.',
    'Enter a listening port.': 'Indiquez un port d\'écoute.',
    'Enter the destination host and port.': 'Indiquez l\'hôte et le port de destination.',
    'Tunnel updated': 'Tunnel modifié',
    'Tunnel saved': 'Tunnel enregistré',
    'The current session keeps the old one until it is relaunched.': 'La session en cours garde l\'ancien tant qu\'elle n\'est pas relancée.',
    'It will be mounted at the next launch of this session.': 'Il sera monté au prochain lancement de cette session.',
    'This tunnel is mounted on the current session. Close the session to be able to delete it.': 'Ce tunnel est monté sur la session en cours. Fermez la session pour pouvoir le supprimer.',

    // sidebarTree.component.ts — selection moves, folder ops, sharing
    'No group': 'Sans groupe',
    '{count} profiles moved to "{where}"': '{count} profils déplacés vers « {where} »',
    'Profile moved to "{where}"': 'Profil déplacé vers « {where} »',
    'Moving the folder failed': 'Le déplacement du dossier a échoué',
    'SVG rejected.': 'SVG rejeté.',
    'No provider handles "{name}": opening the settings': 'Aucun fournisseur ne gère « {name} » — ouverture des paramètres',
    '{name} - Copy': '{name} - Copie',
    'Folder "{name}" copied: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Dossier « {name} » copié — {folders, plural, one {# dossier} other {# dossiers}}, {profiles, plural, one {# profil} other {# profils}}.',
    'Removed: {purged}.': 'Retiré : {purged}.',
    'The clipboard does not hold a shared folder.': 'Le presse-papiers ne contient pas un dossier partagé.',
    'Pasted folder': 'Dossier collé',
    'Folder "{name}" pasted: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Dossier « {name} » collé — {folders, plural, one {# dossier} other {# dossiers}}, {profiles, plural, one {# profil} other {# profils}}.',
    'Removed at export: {purged}. To be re-entered.': 'Retiré à l\'export : {purged} — à ressaisir.',
    '{count, plural, one {Profile type not installed} other {Profile types not installed}}: {list}.':
        '{count, plural, one {Type de profil non installé} other {Types de profil non installés}} : {list}.',
    'This JSON still carried secrets its own header declared removed.': 'Ce JSON contenait encore des secrets que son en-tête déclarait retirés.',
    'Removed at paste: {purged}.': 'Retiré au collage : {purged}.',
    '{count, plural, one {# subfolder} other {# subfolders}}': '{count, plural, one {# sous-dossier} other {# sous-dossiers}}',
    '{count, plural, one {# profile} other {# profiles}}': '{count, plural, one {# profil} other {# profils}}',
    '{a} and {b}': '{a} et {b}',
    'current': 'courant',
    'This content is hidden in the workspace "{name}".': 'Ce contenu est masqué dans le workspace « {name} ».',
    'Cannot delete "{name}"': 'Impossible de supprimer "{name}"',
    'This folder still contains {reasons}.{hint} Empty it first.': 'Ce dossier contient encore {reasons}.{hint} Videz-le d\'abord.',

    // settingsTab.component.ts — nav + general page
    'General': 'Général',
    'Features': 'Fonctionnalités',
    'Show the sidebar': 'Afficher la sidebar',
    'Removes the sidebar without uninstalling anything.': 'Retire la sidebar sans rien désinstaller.',
    'Untick to hide it; this page stays reachable.': 'Décochez pour la masquer ; cette page reste accessible.',
    'Hide the Tabby transfers menu': 'Masquer le menu des transferts de Tabby',
    'Otherwise the native Tabby menu opens on every transfer.': 'Sinon le menu natif de Tabby s\'ouvre à chaque transfert.',
    'The sidebar panel already shows the same transfers.': 'Le panneau de la sidebar affiche déjà les mêmes transferts.',

    // settingsTab.component.ts — features page
    'Each block switches on independently. Nothing is deleted by turning one off.': 'Chaque bloc s\'active indépendamment. Rien n\'est supprimé en l\'éteignant.',
    'Mirrors the state of Tabby port forwarding.': 'Reflète l\'état du port-forwarding de Tabby.',
    'Port forwarding panel and badges on the profiles.': 'Panneau des redirections de ports et pastilles sur les profils.',
    'Unavailable on this version of Tabby. Your setting is kept.': 'Indisponible sur cette version de Tabby. Votre réglage est conservé.',
    'Workspaces': 'Workspaces',
    '"All" excludes nothing; the filter bar searches everywhere.': '« Tous » n\'exclut rien ; la barre de filtrage cherche partout.',
    'Workspace bar, above the list.': 'Barre des espaces de travail, au-dessus de la liste.',
    'Presentation': 'Présentation',
    'Tabs or a compact list, as you prefer.': 'Onglets ou liste compacte, au choix.',
    'Changes how the workspace bar is displayed.': 'Change l\'affichage de la barre des workspaces.',
    'Tabs (wrap onto new lines)': 'Onglets (passent à la ligne)',
    'Dropdown list': 'Liste déroulante',
    'Filter bar': 'Barre de filtrage',
    'Searches the name, description, host and username.': 'Cherche le nom, la description, l\'hôte et l\'utilisateur.',
    'Search field and shortcut': 'Champ de recherche et raccourci',
    'A library of commands attached to profiles and folders.': 'Bibliothèque de commandes attachées aux profils et aux dossiers.',
    'The "Snippets" entry of the right click and its dedicated tab.': 'Entrée « Snippets… » du clic droit et onglet dédié.',
    'Notes': 'Notes',
    'A free-form memo per profile or folder.': 'Un mémento libre par profil ou dossier.',
    'The "note" entry of the right click and its badge.': 'Entrée « note » du clic droit et pastille associée.',
    'Recent profiles': 'Profils récents',
    'The 5 most recently launched profiles, all types together.': 'Les 5 derniers profils lancés, tous types confondus.',
    'A list shown under the active sessions.': 'Liste affichée sous les sessions actives.',
    'One row per pane, not per tab.': 'Une ligne par pane, pas par onglet.',
    'Open SSH connections, at the top of the sidebar.': 'Connexions SSH ouvertes, en haut de la sidebar.',
    'Latency probe, in seconds': 'Mesure de latence, en secondes',
    'A real SFTP round trip, not an ICMP ping.': 'Aller-retour SFTP réel, pas un ping ICMP.',
    'Colors the dot of each session. 0 disables.': 'Colore la pastille de chaque session. 0 désactive.',

    // settingsTab.component.ts — SFTP block
    'SFTP view': 'Vue SFTP',
    'One SFTP channel per session actually browsed.': 'Un canal SFTP par session réellement parcourue.',
    'The SFTP tab of the sidebar and its panel.': 'Onglet SFTP de la sidebar et son panneau.',
    'Remote file editor': 'Éditeur des fichiers distants',
    'The file is copied, edited, then sent back to the server.': 'Le fichier est copié, édité, puis renvoyé au serveur.',
    'Program opened on double-click. Empty, Windows decides.': 'Programme ouvert au double-clic. Vide, Windows décide.',
    'No editor chosen': 'Aucun éditeur choisi',
    'Browse...': 'Parcourir...',
    'Erase': 'Effacer',
    'Drag a folder out to Explorer': 'Glisser un dossier vers l\'Explorateur',
    'The folder is downloaded in full before the drop.': 'Le dossier est téléchargé en entier avant le dépôt.',
    'Beyond 25 files or 20 MB, confirmation is asked.': 'Au-delà de 25 fichiers ou 20 Mo, confirmation demandée.',
    'Automatic refresh, in seconds': 'Rafraîchissement automatique, en secondes',
    'Only changed entries are redrawn.': 'Seules les entrées modifiées sont redessinées.',
    '0 disables; every cycle re-reads the folder.': '0 désactive ; chaque cycle relit le dossier.',
    'Return to Profiles when no SSH session is open any more': 'Revenir sur Profils quand plus aucune session SSH n\'est ouverte',
    'Also covers the waiting screen of the SFTP panel.': 'Couvre aussi l\'écran d\'attente du panneau SFTP.',
    'Waits for the grace period of the displayed session to end.': 'Attend la fin du délai de grâce de la session affichée.',
    'Deletion: button activated by Enter': 'Suppression : bouton activé par Entrée',
    'No deletion can be undone afterwards.': 'Aucune suppression n\'est annulable ensuite.',
    'Applies to': 'S\'applique à',
    'and to the right click.': 'et au clic droit.',
    'always cancels.': 'annule toujours.',
    'Del': 'Suppr',
    'Esc': 'Échap',
    'Cancel: the safe answer (default)': 'Annuler — la réponse sûre (défaut)',
    'Delete: Del then Enter in one gesture': 'Supprimer — Suppr puis Entrée en un geste',
    'Transfer manager': 'Gestionnaire de transferts',
    'Also mirrors the transfers of the native SFTP panel.': 'Reflète aussi les transferts du panneau SFTP natif.',
    'Panel shown at the bottom of the sidebar.': 'Panneau affiché en bas de sidebar.',

    // settingsTab.component.ts — snippet library
    'A command written once, usable everywhere it is attached.': 'Une commande écrite une fois, utilisable partout où elle est attachée.',
    'No snippets yet.': 'Aucun snippet pour l\'instant.',
    '{count} snippet(s) attached to nothing.': '{count} snippet(s) rattachés à rien.',
    'Detached from the sidebar, they stay here until deleted.': 'Détachés depuis la sidebar, ils restent ici jusqu\'à suppression.',
    'attached to {count} item(s)': 'rattaché à {count} élément(s)',
    'attached nowhere': 'rattaché nulle part',
    'Modify': 'Modifier',
    'New snippet': 'Nouveau snippet',
    'What the context menu shows.': 'Ce que montre le menu contextuel.',
    'Restart nginx': 'Redémarrer nginx',
    'Command': 'Commande',
    'Use': 'Utilisez',
    'for a required value, or': 'pour une valeur requise, ou',
    'for a default value.': 'pour une valeur par défaut.',
    'Changes the command on the {count} existing attachment(s).': 'Modifie la commande sur les {count} rattachement(s) existants.',
    'Delete the snippet "{name}"? It is attached to {count} item(s), which will lose it.': 'Supprimer « {name} » ? Il est rattaché à {count} élément(s), qui le perdront.',
    'Delete the snippet "{name}"?': 'Supprimer « {name} » ?',

    // profileModal.ts — PROFILE_MODAL_UNAVAILABLE
    'The Tabby profile window has changed — profile creation and editing are unavailable in this version':
        'La fenêtre de profil de Tabby a changé — création et édition de profils indisponibles sur cette version',

    // groupShare.ts — parsePayload() errors, describePurge() clauses
    'The clipboard is empty.': 'Le presse-papiers est vide.',
    'The clipboard content is too large to be a shared folder.': 'Le contenu du presse-papiers est trop volumineux pour être un dossier partagé.',
    'The clipboard does not contain JSON — copy a folder from the sidebar first.': 'Le presse-papiers ne contient pas de JSON — copiez d\'abord un dossier depuis la sidebar.',
    'The clipboard does not contain a shared folder.': 'Le presse-papiers ne contient pas un dossier partagé.',
    'This JSON was not produced by "Copy the structure" from this sidebar.': 'Ce JSON n\'a pas été produit par « Copier la structure » de cette sidebar.',
    'This folder was exported by a newer version of the plugin (format {version}).': 'Ce dossier a été exporté par une version plus récente du plugin (format {version}).',
    'This shared folder is incomplete: it contains no group.': 'Ce dossier partagé est incomplet : il ne contient aucun groupe.',
    '{count, plural, one {# password} other {# passwords}}': '{count, plural, one {# mot de passe} other {# mots de passe}}',
    '{count, plural, one {# login script} other {# login scripts}}': '{count, plural, one {# script de login} other {# scripts de login}}',
    '{count, plural, one {# vault key} other {# vault keys}}': '{count, plural, one {# clé du coffre-fort} other {# clés du coffre-fort}}',
    '{count, plural, one {# key path} other {# key paths}}': '{count, plural, one {# chemin de clé} other {# chemins de clé}}',
    '{count, plural, one {# credential} other {# credentials and routes}}': '{count, plural, one {# identifiant} other {# identifiants et routes}}',
    '{count, plural, one {# sensitive field} other {# sensitive fields}}': '{count, plural, one {# champ sensible} other {# champs sensibles}}',

    // workspaceShare.ts — parseWorkspacePayload() errors
    'The clipboard content is too large to be an exported workspace.': 'Le contenu du presse-papiers est trop volumineux pour être un workspace exporté.',
    'The clipboard does not contain JSON — copy an exported workspace first.': 'Le presse-papiers ne contient pas de JSON — copiez d\'abord un workspace exporté.',
    'The clipboard does not contain an exported workspace.': 'Le presse-papiers ne contient pas un workspace exporté.',
    'This workspace was exported by a newer version of the plugin (format {version}).': 'Ce workspace a été exporté par une version plus récente du plugin (format {version}).',
    'This exported workspace is incomplete.': 'Ce workspace exporté est incomplet.',

    // svgSanitizer.ts — sanitizeSvgIcon()
    'The SVG is empty.': 'Le SVG est vide.',
    'SVG too large (limit: {limit} characters).': 'SVG trop volumineux (limite : {limit} caractères).',
    'Invalid SVG, or entirely rejected by sanitisation.': 'SVG invalide, ou entièrement rejeté par la sanitisation.',
    'The root must be a single <svg> tag.': 'La racine doit être une unique balise <svg>.',
    '{count} disallowed element(s) or attribute(s) removed.': '{count} élément(s) ou attribut(s) non autorisé(s) ont été retirés.',

}

export default fr_FR
