/**
 * German table — keys are the English source strings used in the code.
 * See fr-FR.ts for how these tables are kept in step with the code.
 *
 * Formal register throughout ("Sie"), matching the project's chosen tone.
 */
const de_DE: Record<string, string> = {
    // sftpPanel.component.ts — header line, auto-return-to-Profiles notices
    'SSH session lost ({tab}) — back to Profiles view': 'SSH-Sitzung verloren ({tab}) — zurück zur Profilübersicht',
    'SSH session lost — back to Profiles view': 'SSH-Sitzung verloren — zurück zur Profilübersicht',
    'No more active SSH session — back to Profiles view': 'Keine aktive SSH-Sitzung mehr — zurück zur Profilübersicht',

    // sftpPanel.component.pug — freeze toggle, waiting placeholder
    'Frozen view — click to follow focus again': 'Ansicht fixiert — klicken, um dem Fokus wieder zu folgen',
    'Freeze view on this session': 'Ansicht auf diese Sitzung fixieren',
    'Waiting for an active SSH session.': 'Warten auf eine aktive SSH-Sitzung.',
    'Open an SSH profile — the panel will follow the selected tab.': 'Öffnen Sie ein SSH-Profil — das Panel folgt dem ausgewählten Tab.',

    // sftpBrowser.component.ts — availableColumns / displayToggles
    'Size': 'Größe',
    'File size': 'Dateigröße',
    'Date': 'Datum',
    'Date modified': 'Änderungsdatum',
    'Perm.': 'Rechte',
    'Permissions in octal (755)': 'Berechtigungen in Oktalform (755)',
    'Rights': 'Modus',
    'Permissions in long form (drwxr-xr-x)': 'Berechtigungen in Langform (drwxr-xr-x)',
    'Type': 'Typ',
    'Item type': 'Elementtyp',
    'Ext.': 'Ext.',
    'File extension': 'Dateierweiterung',
    'Folders first': 'Ordner zuerst',
    'Show hidden files': 'Versteckte Dateien anzeigen',
    'Column borders': 'Spaltenränder',
    'Alternating rows': 'Abwechselnde Zeilen',

    // sftpBrowser.component.ts — downloadFolder()
    'Destination folder for {name}': 'Zielordner für {name}',
    'Download here': 'Hier herunterladen',
    '{name} downloaded to {base}': '{name} nach {base} heruntergeladen',
    '{name}: incomplete download': '{name}: unvollständiger Download',

    // sftpBrowser.component.ts — createFileFromMenu()
    'New file name': 'Name der neuen Datei',
    'The name cannot contain "/"': 'Der Name darf kein „/“ enthalten',
    '{name} already exists': '{name} existiert bereits',
    'Could not create {name}': '{name} konnte nicht erstellt werden',

    // sftpBrowser.component.ts — openEntry()
    'Could not follow the link {name}': 'Der Verknüpfung {name} konnte nicht gefolgt werden',
    '{name} points to a target that cannot be found': '{name} verweist auf ein nicht auffindbares Ziel',
    '{name} → {target}': '{name} → {target}',

    // sftpBrowser.component.ts — confirmHeavyDirectory()
    'Could not read the contents of {name}': 'Der Inhalt von {name} konnte nicht gelesen werden',
    '"{name}" contains more than {count} files ({size} at least). Everything will be downloaded before drag-and-drop becomes possible, with no progress and no way to cancel. Continue?':
        '„{name}“ enthält mehr als {count} Dateien (mindestens {size}). Alles wird heruntergeladen, bevor Ziehen-und-Ablegen möglich wird, ohne Fortschrittsanzeige und ohne Abbruchmöglichkeit. Fortfahren?',
    'Download': 'Herunterladen',

    // sftpBrowser.component.ts — receiveDrop() / resolveDestination()
    'Could not read what was dropped': 'Das Abgelegte konnte nicht gelesen werden',
    '{name} is not a folder — nothing was moved': '{name} ist kein Ordner — nichts wurde verschoben',
    '{name} is not a folder — sending to {path}': '{name} ist kein Ordner — wird nach {path} gesendet',

    // sftpBrowser.component.ts — confirmOverwrite()
    '{names}, and {rest, plural, one {# more} other {# more}}': '{names} und {rest, plural, one {# weiterer} other {# weitere}}',
    '{count} files already exist under {destination} and will be overwritten: {list}. Continue?':
        '{count} Dateien existieren bereits unter {destination} und werden überschrieben: {list}. Fortfahren?',
    'A file already exists under {destination} and will be overwritten: {list}. Continue?':
        'Eine Datei existiert bereits unter {destination} und wird überschrieben: {list}. Fortfahren?',
    'Overwrite': 'Überschreiben',

    // sftpBrowser.component.ts — reportDrop()
    // "Ordner" and "gesendet" do not inflect for number in German, so both
    // plural branches carry the same word — the `#` inside each still keeps
    // them safely out of a bare-placeholder false positive in the lint
    // script (see fr-FR.ts for the case that actually triggered it).
    '{sent, plural, one {# file} other {# files}} sent to {destination} ({folders, plural, one {# folder} other {# folders}})':
        '{sent, plural, one {# Datei gesendet} other {# Dateien gesendet}} an {destination} ({folders, plural, one {# Ordner} other {# Ordner}})',
    '{sent, plural, one {# file} other {# files}} sent to {destination}':
        '{sent, plural, one {# Datei gesendet} other {# Dateien gesendet}} an {destination}',
    '{folders, plural, one {# folder} other {# folders}} created in {destination}':
        '{folders, plural, one {# Ordner erstellt} other {# Ordner erstellt}} in {destination}',
    'Could not send {failed, plural, one {# file} other {# files}} of {total}':
        'Senden von {failed, plural, one {# Datei} other {# Dateien}} von {total} fehlgeschlagen',

    // sftpBrowser.component.ts — askedToLeave()
    'Dragging folders out is disabled — enable it in Settings → Better Sidebar':
        'Ordner nach außen ziehen ist deaktiviert — aktivieren Sie es unter Einstellungen → Better Sidebar',

    // sftpBrowser.component.ts — receiveMove()
    '{name} cannot be moved into itself': '{name} kann nicht in sich selbst verschoben werden',
    '{name} already exists in {destination}': '{name} existiert bereits in {destination}',
    'Could not move {name}: {error}': '{name} konnte nicht verschoben werden: {error}',
    '{name} moved to {destination}': '{name} nach {destination} verschoben',
    'Could not move {name} to {destination}': '{name} konnte nicht nach {destination} verschoben werden',
    '{count} items moved to {destination}': '{count} Elemente nach {destination} verschoben',
    'No move succeeded': 'Keine Verschiebung war erfolgreich',
    '{succeeded} moved, {failed} failed': '{succeeded} verschoben, {failed} fehlgeschlagen',

    // sftpBrowser.component.ts — showContextMenu()
    'Open with...': 'Öffnen mit...',
    'Rename...': 'Umbenennen...',
    'Delete': 'Löschen',
    'Delete selection ({count})': 'Auswahl löschen ({count})',

    // sftpBrowser.component.ts — renameEntry()
    'New name for "{name}"': 'Neuer Name für „{name}“',
    'The name cannot contain "/" — this renames, it does not move': 'Der Name darf kein „/“ enthalten — das benennt um, es verschiebt nicht',
    '{name} already exists in this folder': '{name} existiert bereits in diesem Ordner',
    'Could not rename {name}': '{name} konnte nicht umbenannt werden',
    '{old} renamed to {new}': '{old} umbenannt in {new}',

    // sftpBrowser.component.ts — delete confirmations (single + bulk)
    'Delete folder "{name}" and everything in it?': 'Ordner „{name}“ und seinen gesamten Inhalt löschen?',
    'Confirm deletion of "{name}"?': 'Löschen von „{name}“ bestätigen?',
    '{name} deleted': '{name} gelöscht',
    'Could not delete {name}': '{name} konnte nicht gelöscht werden',
    'Delete {count} items? This action is irreversible.': '{count} Elemente löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    '{name}: {error}': '{name}: {error}',
    '{count} items deleted': '{count} Elemente gelöscht',
    '{succeeded} deleted, {failed} failed': '{succeeded} gelöscht, {failed} fehlgeschlagen',

    // sftpBrowser.component.ts — typeLabel() / rowTooltip()
    'Link': 'Verknüpfung',
    'Folder': 'Ordner',
    'File': 'Datei',
    'Size: {size} ({bytes} bytes)': 'Größe: {size} ({bytes} Bytes)',
    'Modified: {date}': 'Geändert: {date}',
    'Permissions: {octal} — {long}': 'Berechtigungen: {octal} — {long}',
    'Type: {type}': 'Typ: {type}',
    'Symbolic link': 'Symbolische Verknüpfung',

    // sftpBrowser.component.pug — toolbar
    'Double-click to type a path': 'Doppelklick, um einen Pfad einzugeben',
    'Type the path by hand': 'Pfad von Hand eingeben',
    'Refresh': 'Aktualisieren',
    'Filter the list': 'Liste filtern',
    'New remote folder': 'Neuer Remote-Ordner',
    'Send files to the server': 'Dateien an den Server senden',
    'Send a folder to the server': 'Ordner an den Server senden',
    'Filter...': 'Filtern...',
    'Clear the filter': 'Filter löschen',

    // sftpBrowser.component.pug — body, grid, sentinel
    'Connecting...': 'Verbindung wird hergestellt...',
    'Loading...': 'Wird geladen...',
    'Name': 'Name',
    'Go up one level': 'Eine Ebene nach oben',
    '… {n} more items': '… {n} weitere Elemente',
    'No file matches the filter.': 'Keine Datei entspricht dem Filter.',

    // sftpBrowser.component.pug — floating menus
    'Create a folder': 'Ordner erstellen',
    'Create a file': 'Datei erstellen',
    'Display settings': 'Anzeigeeinstellungen',
    'Columns': 'Spalten',

    // confirmModal.component.ts/.pug
    'Confirm': 'Bestätigen',
    'Cancel': 'Abbrechen',

    // noteModal.component.pug
    'Note: {name}': 'Notiz — {name}',
    'Restart commands, maintenance reminders, ticket numbers…': 'Neustartbefehle, Wartungserinnerungen, Ticketnummern…',
    'Clearing the field removes the note.': 'Das Leeren des Felds entfernt die Notiz.',
    'Save': 'Speichern',

    // pasteGroupModal.component.ts/.pug
    'Paste the folder: {name}': 'Ordner einfügen — {name}',
    'A folder named <strong>{name}</strong> already exists at the root.': 'Ein Ordner namens <strong>{name}</strong> existiert bereits im Stammverzeichnis.',
    'To paste: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Einzufügen: {folders, plural, one {# Ordner} other {# Ordner}}, {profiles, plural, one {# Profil} other {# Profile}}.',
    'Removed from the export: {info}. Re-enter after pasting.': 'Aus dem Export entfernt: {info}. Nach dem Einfügen erneut eingeben.',
    'Paste alongside': 'Daneben einfügen',
    'A new folder "{name}". Nothing existing is touched.': 'Ein neuer Ordner „{name}“. Nichts Bestehendes wird verändert.',
    'Merge into the existing folder': 'In den bestehenden Ordner zusammenführen',
    'Profiles and subfolders added to "{name}". Duplicates are not detected.': 'Profile und Unterordner zu „{name}“ hinzugefügt. Duplikate werden nicht erkannt.',

    // snippetsModal.component.pug
    'Snippets: {name}': 'Snippets — {name}',
    'No snippets.': 'Keine Snippets.',
    'Variables and behaviour of this snippet here': 'Variablen und Verhalten dieses Snippets hier',
    'Remove from here: stays in the library': 'Von hier entfernen — bleibt in der Bibliothek',
    'Detach': 'Lösen',
    'Variables': 'Variablen',
    'Required, not filled in.': 'Erforderlich, nicht ausgefüllt.',
    '"{value}" contains a space and is not quoted. Write "{token}" in the command, or quote the value here.':
        '„{value}“ enthält ein Leerzeichen und ist nicht in Anführungszeichen gesetzt. Schreiben Sie „{token}“ im Befehl, oder setzen Sie den Wert hier in Anführungszeichen.',
    'Behaviour': 'Verhalten',
    'On click': 'Beim Klicken',
    'Follow (run)': 'Folgen (ausführen)',
    'Follow (write)': 'Folgen (schreiben)',
    'Write without confirming': 'Schreiben ohne Bestätigung',
    'Write and run': 'Schreiben und ausführen',
    'Without a session': 'Ohne Sitzung',
    'Follow (launch)': 'Folgen (starten)',
    'Follow (do nothing)': 'Folgen (nichts tun)',
    'Do nothing': 'Nichts tun',
    'Launch the session': 'Sitzung starten',
    'Wait': 'Wartezeit',
    'to fill in': 'auszufüllen',
    'follow': 'folgen',
    'Inherited': 'Geerbt',
    'Reactivate here': 'Hier reaktivieren',
    'No longer offer here: stays attached to the folder': 'Hier nicht mehr anbieten — bleibt mit dem Ordner verknüpft',
    'Reactivate': 'Reaktivieren',
    'Disable here': 'Hier deaktivieren',
    'Available snippets': 'Verfügbare Snippets',
    'Attach here': 'Hier verknüpfen',
    'Attach': 'Verknüpfen',
    'Inherit (run)': 'Erben (ausführen)',
    'Inherit (write)': 'Erben (schreiben)',
    'Inherit (launch)': 'Erben (starten)',
    'Inherit (do nothing)': 'Erben (nichts tun)',
    'Inherited from the content of the folder.': 'Geerbt vom Inhalt des Ordners.',
    'Manage the library': 'Bibliothek verwalten',
    'Close': 'Schließen',

    // transfers.component.pug — header, per-row states and tooltips (lot 3)
    'Transfers': 'Übertragungen',
    'Clear the list — running transfers will be cancelled': 'Liste leeren — laufende Übertragungen werden abgebrochen',
    'Transfer finished — the system is still placing the file at its destination. The shown duration is an estimate: nothing signals when this copy ends.': 'Übertragung abgeschlossen — das System legt die Datei noch am Ziel ab. Die angezeigte Dauer ist geschätzt: Nichts meldet das Ende dieser Kopie.',
    'handing over to the system…': 'Übergabe an das System…',
    'cancelled': 'abgebrochen',
    'interrupted at {percent} %': 'unterbrochen bei {percent} %',
    'incomplete at destination': 'unvollständig am Ziel',
    'Estimated time remaining': 'Geschätzte Restzeit',
    'Elapsed time': 'Verstrichene Zeit',
    'Cancel this transfer and remove it': 'Diese Übertragung abbrechen und entfernen',
    'Remove from the list': 'Aus der Liste entfernen',

    // transfers.component.ts — confirmations
    'Cancel "{name}" while it is running?': 'Laufende Übertragung „{name}“ abbrechen?',
    'Cancel the transfer': 'Übertragung abbrechen',
    'One transfer is still running. Clearing the list will cancel it. Continue?': 'Eine Übertragung läuft noch. Das Leeren der Liste bricht sie ab. Fortfahren?',
    '{count} transfers are still running. Clearing the list will cancel them. Continue?': '{count} Übertragungen laufen noch. Das Leeren der Liste bricht sie ab. Fortfahren?',
    'Clear and cancel': 'Leeren und abbrechen',

    // transfersRegistry.service.ts — badge, breakdown tooltip, row tooltip
    'Session: {label}': 'Sitzung: {label}',
    '{count} running': '{count} aktiv',
    '{count, plural, one {# finished} other {# finished}}': '{count, plural, one {# abgeschlossen} other {# abgeschlossen}}',
    '{count, plural, one {# cancelled} other {# cancelled}}': '{count, plural, one {# abgebrochen} other {# abgebrochen}}',
    '{count, plural, one {# interrupted} other {# interrupted}}': '{count, plural, one {# unterbrochen} other {# unterbrochen}}',
    '{count, plural, one {# incomplete at destination} other {# incomplete at destination}}': '{count, plural, one {# unvollständig am Ziel} other {# unvollständig am Ziel}}',

    // sidebarTree.component.pug — view tabs, live sessions, recents, tunnels (lot 3)
    'Profiles': 'Profile',
    'SFTP of the active session': 'SFTP der aktiven Sitzung',
    'Active sessions': 'Aktive Sitzungen',
    'Open the SFTP of this session': 'SFTP dieser Sitzung öffnen',
    'Recently launched': 'Zuletzt verwendet',
    'Active tunnels': 'Aktive Tunnel',
    'resuming…': 'Wiederaufnahme…',
    'not restored': 'nicht wiederhergestellt',
    'Open {url} in the browser': '{url} im Browser öffnen',
    'Go to the session': 'Zur Sitzung wechseln',

    // sidebarTree.component.pug — workspace bar, filter, selection, hidden items
    'All': 'Alle',
    'New workspace': 'Neuer Arbeitsbereich',
    'Filter (Ctrl+F)': 'Filtern (Strg+F)',
    'Hidden items in this workspace': 'Ausgeblendete Elemente in diesem Arbeitsbereich',
    '{count, plural, one {# profile selected} other {# profiles selected}}': '{count, plural, one {# Profil ausgewählt} other {# Profile ausgewählt}}',
    'Clear the selection': 'Auswahl aufheben',
    'Drag the selection, or right-click the destination folder': 'Auswahl ziehen oder Zielordner mit Rechtsklick wählen',
    'No hidden items in this workspace.': 'Keine ausgeblendeten Elemente in diesem Arbeitsbereich.',
    'Show again': 'Wieder anzeigen',

    // sidebarTree.component.pug — profile row badges
    'Connected': 'Verbunden',
    'Disconnected': 'Getrennt',
    'No session': 'Keine Sitzung',
    '{count} tunnel(s) mounted on this session': '{count} Tunnel auf dieser Sitzung aktiv',
    '{count} tunnel(s) configured: mounted when the session launches': '{count} Tunnel konfiguriert: werden beim Sitzungsstart aufgebaut',
    'Upload in progress': 'Upload läuft',
    'Download in progress': 'Download läuft',

    // sidebarTree.component.pug — context menus
    'Move the selection here ({count})': 'Auswahl hierher verschieben ({count})',
    'Launch all sessions': 'Alle Sitzungen starten',
    'Edit the note...': 'Notiz bearbeiten...',
    'Add a note...': 'Notiz hinzufügen...',
    'Remove from favorites': 'Aus Favoriten entfernen',
    'Add to favorites': 'Zu Favoriten hinzufügen',
    'New folder...': 'Neuer Ordner...',
    'New profile...': 'Neues Profil...',
    'Change the icon...': 'Symbol ändern...',
    'Copy the structure (JSON)': 'Struktur kopieren (JSON)',
    'Copy without credentials': 'Ohne Zugangsdaten kopieren',
    'Hide in this workspace': 'In diesem Arbeitsbereich ausblenden',
    'Paste the folder': 'Gruppe einfügen',
    'Profile tunnels...': 'Profil-Tunnel...',
    'Edit...': 'Bearbeiten...',
    'Duplicate': 'Duplizieren',

    // sidebarTree.component.pug — icon picker
    'Choose an icon': 'Symbol wählen',
    'Remove the icon': 'Symbol entfernen',
    'Favorites': 'Favoriten',
    'Right-click an icon: "Add to favorites"': 'Rechtsklick auf ein Symbol → „Zu Favoriten hinzufügen“',
    'Recently used': 'Zuletzt benutzt',
    'Search (e.g. server, folder, star...)': 'Suchen (z. B. server, folder, star...)',
    'Import from an SVG...': 'Aus einem SVG importieren...',
    'Apply the SVG': 'SVG anwenden',

    // sidebarTree.component.pug — icon picker, dashboard-icons variant dots
    'Default variant': 'Standardvariante',
    'Light variant': 'Helle Variante',
    'Dark variant': 'Dunkle Variante',

    // sidebarTree.component.pug — rename/create popups
    'Rename': 'Umbenennen',
    'New folder': 'Neuer Ordner',
    'Folder name': 'Ordnername',
    'Create': 'Erstellen',

    // sidebarTree.component.pug — profile tunnels popup
    'Tunnels: {name}': 'Tunnel — {name}',
    'No tunnels configured on this profile.': 'Keine Tunnel für dieses Profil konfiguriert.',
    'Double-click to edit this tunnel': 'Doppelklick, um diesen Tunnel zu bearbeiten',
    'Delete this tunnel': 'Diesen Tunnel löschen',
    'This tunnel is currently mounted on the open session. Deleting it here would remove its configuration without cutting the tunnel, which would keep running until the session closes. Close the session to be able to delete it.':
        'Dieser Tunnel ist auf der offenen Sitzung aktiv. Ihn hier zu löschen würde nur seine Konfiguration entfernen, ohne den Tunnel zu trennen — er liefe bis zum Ende der Sitzung weiter. Schließen Sie die Sitzung, um ihn löschen zu können.',
    'Listening port': 'Abhörport',
    'Target host': 'Zielhost',
    'Target port': 'Zielport',
    'Description (optional)': 'Beschreibung (optional)',
    'Add the tunnel': 'Tunnel hinzufügen',
    'Takes effect at the next session launch.': 'Wird beim nächsten Start der Sitzung wirksam.',

    // sidebarTree.component.pug — profile/workspace popups, footer
    'New profile': 'Neues Profil',
    'Delete the profile': 'Profil löschen',
    'Delete "{name}"? This action is irreversible.': '„{name}“ löschen? Diese Aktion ist unwiderruflich.',
    'Icon...': 'Symbol...',
    'Color...': 'Farbe...',
    'Copy (JSON)': 'Kopieren (JSON)',
    'Manage this workspace': 'Diesen Arbeitsbereich verwalten',
    'New workspace...': 'Neuer Arbeitsbereich...',
    'Workspace name': 'Name des Arbeitsbereichs',
    'Import from the clipboard': 'Aus der Zwischenablage importieren',
    'Rename the workspace': 'Arbeitsbereich umbenennen',
    'Workspace color': 'Farbe des Arbeitsbereichs',
    'Remove the color': 'Farbe entfernen',
    'Delete the workspace': 'Arbeitsbereich löschen',
    'Delete "{name}"? Hidden profiles and folders become visible everywhere else. This action is irreversible.':
        '„{name}“ löschen? Ausgeblendete Profile und Ordner werden überall sonst wieder sichtbar. Diese Aktion ist unwiderruflich.',
    'Better Sidebar settings': 'Better-Sidebar-Einstellungen',

    // sidebarTree.component.ts — snippets notices, workspaces, pinned group
    'Variables to fill in on "{name}"': 'Auszufüllende Variablen bei „{name}“',
    '{detail}: right-click the profile, "Snippets", then the snippet settings button.': '{detail}: Rechtsklick auf das Profil, „Snippets…“, dann die Einstellungen des Snippets.',
    'This folder contains no profile to launch': 'Dieser Ordner enthält kein startbares Profil',
    'The clipboard does not hold an exported workspace.': 'Die Zwischenablage enthält keinen exportierten Arbeitsbereich.',
    'Imported workspace': 'Importierter Arbeitsbereich',
    'Workspace "{name}" imported.': 'Arbeitsbereich „{name}“ importiert.',
    'Workspace "{name}" copied.': 'Arbeitsbereich „{name}“ kopiert.',
    'Pinned': 'Angeheftet',
    '"{name}" expects a value': '„{name}“ erwartet einen Wert',
    '{list}: to fill in under "Snippets".': '{list}: unter „Snippets…“ auszufüllen.',
    '"{name}" has no open session': '„{name}“ hat keine offene Sitzung',
    'The session of "{name}" did not open': 'Die Sitzung von „{name}“ wurde nicht geöffnet',

    // sidebarTree.component.ts — session tooltips, uptime units (only the day unit varies)
    'Transfers: {count} running, total speed {speed}': 'Übertragungen: {count} laufend, Gesamtgeschwindigkeit {speed}',
    'Transfers: {count} running': 'Übertragungen: {count} laufend',
    '{d}d {h}h': '{d}T {h}h',
    '{d} d {h} h': '{d} T {h} h',

    // sidebarTree.component.ts — tunnels (rows, hints, editor)
    '{detail}: session cut, tunnel waiting to resume': '{detail}: Sitzung getrennt, Tunnel wartet auf Wiederaufnahme',
    '{detail}: not restored after the reconnection. Only the tunnels saved in the profile are remounted; a tunnel added on the fly disappears with its session.':
        '{detail}: nach der Wiederverbindung nicht wiederhergestellt. Nur im Profil gespeicherte Tunnel werden neu aufgebaut; ein spontan hinzugefügter Tunnel verschwindet mit der Sitzung.',
    'Tunnel {detail} already mounted by {owner}: duplicate dismounted ({session})': 'Tunnel {detail} bereits von {owner} aufgebaut: Duplikat abgebaut ({session})',
    'Listens on the remote server. The destination is resolved from your PC.': 'Lauscht auf dem entfernten Server. Das Ziel wird von Ihrem PC aus aufgelöst.',
    'Opens a SOCKS proxy on your PC, with no fixed destination.': 'Öffnet einen SOCKS-Proxy auf Ihrem PC, ohne festes Ziel.',
    'Listens on your PC. The destination is resolved from the server, so "localhost" there means the server.':
        'Lauscht auf Ihrem PC. Das Ziel wird vom Server aus aufgelöst — „localhost“ meint dort also den Server.',
    'Enter a listening port.': 'Geben Sie einen Abhörport an.',
    'Enter the destination host and port.': 'Geben Sie Zielhost und Zielport an.',
    'Tunnel updated': 'Tunnel geändert',
    'Tunnel saved': 'Tunnel gespeichert',
    'The current session keeps the old one until it is relaunched.': 'Die laufende Sitzung behält den alten, bis sie neu gestartet wird.',
    'It will be mounted at the next launch of this session.': 'Er wird beim nächsten Start dieser Sitzung aufgebaut.',
    'This tunnel is mounted on the current session. Close the session to be able to delete it.': 'Dieser Tunnel ist auf der laufenden Sitzung aktiv. Schließen Sie die Sitzung, um ihn löschen zu können.',

    // sidebarTree.component.ts — selection moves, folder ops, sharing
    'No group': 'Ohne Gruppe',
    '{count} profiles moved to "{where}"': '{count} Profile nach „{where}“ verschoben',
    'Profile moved to "{where}"': 'Profil nach „{where}“ verschoben',
    'Moving the folder failed': 'Das Verschieben des Ordners ist fehlgeschlagen',
    'SVG rejected.': 'SVG abgelehnt.',
    'No provider handles "{name}": opening the settings': 'Kein Anbieter verwaltet „{name}“: Einstellungen werden geöffnet',
    '{name} - Copy': '{name} - Kopie',
    'Folder "{name}" copied: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Ordner „{name}“ kopiert: {folders, plural, one {# Ordner} other {# Ordner}}, {profiles, plural, one {# Profil} other {# Profile}}.',
    'Removed: {purged}.': 'Entfernt: {purged}.',
    'The clipboard does not hold a shared folder.': 'Die Zwischenablage enthält keinen geteilten Ordner.',
    'Pasted folder': 'Eingefügter Ordner',
    'Folder "{name}" pasted: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Ordner „{name}“ eingefügt: {folders, plural, one {# Ordner} other {# Ordner}}, {profiles, plural, one {# Profil} other {# Profile}}.',
    'Removed at export: {purged}. To be re-entered.': 'Beim Export entfernt: {purged}. Muss neu eingegeben werden.',
    '{count, plural, one {Profile type not installed} other {Profile types not installed}}: {list}.':
        '{count, plural, one {Nicht installierter Profiltyp} other {Nicht installierte Profiltypen}}: {list}.',
    'This JSON still carried secrets its own header declared removed.': 'Dieses JSON enthielt noch Geheimnisse, die sein eigener Kopf als entfernt deklarierte.',
    'Removed at paste: {purged}.': 'Beim Einfügen entfernt: {purged}.',
    '{count, plural, one {# subfolder} other {# subfolders}}': '{count, plural, one {# Unterordner} other {# Unterordner}}',
    '{count, plural, one {# profile} other {# profiles}}': '{count, plural, one {# Profil} other {# Profile}}',
    '{a} and {b}': '{a} und {b}',
    'current': 'aktuell',
    'This content is hidden in the workspace "{name}".': 'Dieser Inhalt ist im Arbeitsbereich „{name}“ ausgeblendet.',
    'Cannot delete "{name}"': '„{name}“ kann nicht gelöscht werden',
    'This folder still contains {reasons}.{hint} Empty it first.': 'Dieser Ordner enthält noch {reasons}.{hint} Leeren Sie ihn zuerst.',

    // settingsTab.component.ts — nav + general page
    'General': 'Allgemein',
    'Features': 'Funktionen',
    'Show the sidebar': 'Sidebar anzeigen',
    'Removes the sidebar without uninstalling anything.': 'Entfernt die Sidebar, ohne etwas zu deinstallieren.',
    'Untick to hide it; this page stays reachable.': 'Abwählen, um sie auszublenden; diese Seite bleibt erreichbar.',
    'Hide the Tabby transfers menu': 'Das Übertragungsmenü von Tabby ausblenden',
    'Otherwise the native Tabby menu opens on every transfer.': 'Sonst öffnet sich das native Tabby-Menü bei jeder Übertragung.',
    'The sidebar panel already shows the same transfers.': 'Das Sidebar-Panel zeigt dieselben Übertragungen bereits an.',

    // settingsTab.component.ts — features page
    'Each block switches on independently. Nothing is deleted by turning one off.': 'Jeder Block lässt sich unabhängig aktivieren. Beim Ausschalten wird nichts gelöscht.',
    'Mirrors the state of Tabby port forwarding.': 'Spiegelt den Stand der Portweiterleitung von Tabby.',
    'Port forwarding panel and badges on the profiles.': 'Panel der Portweiterleitungen und Markierungen an den Profilen.',
    'Unavailable on this version of Tabby. Your setting is kept.': 'In dieser Tabby-Version nicht verfügbar. Ihre Einstellung bleibt erhalten.',
    'Workspaces': 'Arbeitsbereiche',
    '"All" excludes nothing; the filter bar searches everywhere.': '„Alle“ schließt nichts aus; die Filterleiste sucht überall.',
    'Workspace bar, above the list.': 'Leiste der Arbeitsbereiche, über der Liste.',
    'Presentation': 'Darstellung',
    'Tabs or a compact list, as you prefer.': 'Tabs oder kompakte Liste, nach Wahl.',
    'Changes how the workspace bar is displayed.': 'Ändert die Darstellung der Arbeitsbereichsleiste.',
    'Tabs (wrap onto new lines)': 'Tabs (umbrechen in neue Zeilen)',
    'Dropdown list': 'Aufklappliste',
    'Filter bar': 'Filterleiste',
    'Searches the name, description, host and username.': 'Durchsucht Name, Beschreibung, Host und Benutzer.',
    'Search field and shortcut': 'Suchfeld und Tastenkürzel',
    'A library of commands attached to profiles and folders.': 'Bibliothek von Befehlen, die an Profile und Ordner angehängt sind.',
    'The "Snippets" entry of the right click and its dedicated tab.': 'Eintrag „Snippets…“ im Rechtsklickmenü und eigener Tab.',
    'Notes': 'Notizen',
    'A free-form memo per profile or folder.': 'Eine freie Notiz je Profil oder Ordner.',
    'The "note" entry of the right click and its badge.': 'Eintrag „Notiz“ im Rechtsklickmenü und zugehörige Markierung.',
    'Recent profiles': 'Zuletzt verwendete Profile',
    'The 5 most recently launched profiles, all types together.': 'Die 5 zuletzt gestarteten Profile, über alle Typen hinweg.',
    'A list shown under the active sessions.': 'Liste unter den aktiven Sitzungen.',
    'One row per pane, not per tab.': 'Eine Zeile je Teilfenster, nicht je Tab.',
    'Open SSH connections, at the top of the sidebar.': 'Offene SSH-Verbindungen, oben in der Sidebar.',
    'Latency probe, in seconds': 'Latenzmessung, in Sekunden',
    'A real SFTP round trip, not an ICMP ping.': 'Echter SFTP-Umlauf, kein ICMP-Ping.',
    'Colors the dot of each session. 0 disables.': 'Färbt den Punkt jeder Sitzung. 0 deaktiviert.',

    // settingsTab.component.ts — SFTP block
    'SFTP view': 'SFTP-Ansicht',
    'One SFTP channel per session actually browsed.': 'Ein SFTP-Kanal je tatsächlich durchsuchter Sitzung.',
    'The SFTP tab of the sidebar and its panel.': 'SFTP-Tab der Sidebar und sein Panel.',
    'Remote file editor': 'Editor für entfernte Dateien',
    'The file is copied, edited, then sent back to the server.': 'Die Datei wird kopiert, bearbeitet und dann zum Server zurückgeschickt.',
    'Program opened on double-click. Empty, Windows decides.': 'Programm für den Doppelklick. Leer entscheidet Windows.',
    'No editor chosen': 'Kein Editor gewählt',
    'Browse...': 'Durchsuchen...',
    'Erase': 'Leeren',
    'Drag a folder out to Explorer': 'Einen Ordner in den Explorer ziehen',
    'The folder is downloaded in full before the drop.': 'Der Ordner wird vor dem Ablegen vollständig heruntergeladen.',
    'Beyond 25 files or 20 MB, confirmation is asked.': 'Ab 25 Dateien oder 20 MB wird eine Bestätigung verlangt.',
    'Automatic refresh, in seconds': 'Automatische Aktualisierung, in Sekunden',
    'Only changed entries are redrawn.': 'Nur geänderte Einträge werden neu gezeichnet.',
    '0 disables; every cycle re-reads the folder.': '0 deaktiviert; jeder Zyklus liest den Ordner neu.',
    'Return to Profiles when no SSH session is open any more': 'Zu Profilen zurückkehren, wenn keine SSH-Sitzung mehr offen ist',
    'Also covers the waiting screen of the SFTP panel.': 'Deckt auch den Wartebildschirm des SFTP-Panels ab.',
    'Waits for the grace period of the displayed session to end.': 'Wartet das Ende der Gnadenfrist der angezeigten Sitzung ab.',
    'Deletion: button activated by Enter': 'Löschen: mit Eingabetaste bestätigte Schaltfläche',
    'No deletion can be undone afterwards.': 'Kein Löschen lässt sich nachträglich rückgängig machen.',
    'Applies to': 'Gilt für',
    'and to the right click.': 'und für den Rechtsklick.',
    'always cancels.': 'bricht immer ab.',
    'Del': 'Entf',
    'Esc': 'Esc',
    'Cancel: the safe answer (default)': 'Abbrechen: die sichere Antwort (Standard)',
    'Delete: Del then Enter in one gesture': 'Löschen: Entf und dann Eingabe in einem Zug',
    'Transfer manager': 'Übertragungsmanager',
    'Also mirrors the transfers of the native SFTP panel.': 'Spiegelt auch die Übertragungen des nativen SFTP-Panels.',
    'Panel shown at the bottom of the sidebar.': 'Panel unten in der Sidebar.',

    // settingsTab.component.ts — snippet library
    'A command written once, usable everywhere it is attached.': 'Ein einmal geschriebener Befehl, nutzbar überall, wo er angehängt ist.',
    'No snippets yet.': 'Noch keine Snippets.',
    '{count} snippet(s) attached to nothing.': '{count} Snippet(s) an nichts angehängt.',
    'Detached from the sidebar, they stay here until deleted.': 'Von der Sidebar gelöst, bleiben sie hier bis zur Löschung.',
    'attached to {count} item(s)': 'an {count} Element(e) angehängt',
    'attached nowhere': 'nirgends angehängt',
    'Modify': 'Bearbeiten',
    'New snippet': 'Neues Snippet',
    'What the context menu shows.': 'Was das Kontextmenü anzeigt.',
    'Restart nginx': 'nginx neu starten',
    'Command': 'Befehl',
    'Use': 'Verwenden Sie',
    'for a required value, or': 'für einen Pflichtwert oder',
    'for a default value.': 'für einen Standardwert.',
    'Changes the command on the {count} existing attachment(s).': 'Ändert den Befehl an den {count} bestehenden Anhängen.',
    'Delete the snippet "{name}"? It is attached to {count} item(s), which will lose it.': '„{name}“ löschen? Es ist an {count} Element(e) angehängt, die es verlieren.',
    'Delete the snippet "{name}"?': '„{name}“ löschen?',

    // profileModal.ts — PROFILE_MODAL_UNAVAILABLE
    'The Tabby profile window has changed — profile creation and editing are unavailable in this version':
        'Das Profilfenster von Tabby hat sich geändert — in dieser Version können keine Profile erstellt oder bearbeitet werden',

    // groupShare.ts — parsePayload() errors, describePurge() clauses
    'The clipboard is empty.': 'Die Zwischenablage ist leer.',
    'The clipboard content is too large to be a shared folder.': 'Der Inhalt der Zwischenablage ist zu groß, um ein geteilter Ordner zu sein.',
    'The clipboard does not contain JSON — copy a folder from the sidebar first.': 'Die Zwischenablage enthält kein JSON — kopieren Sie zuerst einen Ordner aus der Seitenleiste.',
    'The clipboard does not contain a shared folder.': 'Die Zwischenablage enthält keinen geteilten Ordner.',
    'This JSON was not produced by "Copy the structure" from this sidebar.': 'Dieses JSON wurde nicht von „Struktur kopieren" in dieser Seitenleiste erzeugt.',
    'This folder was exported by a newer version of the plugin (format {version}).': 'Dieser Ordner wurde von einer neueren Version des Plugins exportiert (Format {version}).',
    'This shared folder is incomplete: it contains no group.': 'Dieser geteilte Ordner ist unvollständig: er enthält keine Gruppe.',
    '{count, plural, one {# password} other {# passwords}}': '{count, plural, one {# Passwort} other {# Passwörter}}',
    '{count, plural, one {# login script} other {# login scripts}}': '{count, plural, one {# Login-Skript} other {# Login-Skripte}}',
    '{count, plural, one {# vault key} other {# vault keys}}': '{count, plural, one {# Tresor-Schlüssel} other {# Tresor-Schlüssel}}',
    '{count, plural, one {# key path} other {# key paths}}': '{count, plural, one {# Schlüsselpfad} other {# Schlüsselpfade}}',
    '{count, plural, one {# credential} other {# credentials and routes}}': '{count, plural, one {# Zugangsdaten-Eintrag} other {# Zugangsdaten und Routen}}',
    '{count, plural, one {# sensitive field} other {# sensitive fields}}': '{count, plural, one {# sensibles Feld} other {# sensible Felder}}',
    '{count, plural, one {# proxy command} other {# proxy commands}}': '{count, plural, one {# Proxy-Befehl} other {# Proxy-Befehle}}',
    '{count, plural, one {# unrecognised option} other {# unrecognised options}}': '{count, plural, one {# unbekannte Option} other {# unbekannte Optionen}}',
    '{count, plural, one {# profile of an unsupported type} other {# profiles of an unsupported type}}': '{count, plural, one {# Profil eines nicht unterstützten Typs} other {# Profile eines nicht unterstützten Typs}}',

    // workspaceShare.ts — parseWorkspacePayload() errors
    'The clipboard content is too large to be an exported workspace.': 'Der Inhalt der Zwischenablage ist zu groß, um ein exportierter Workspace zu sein.',
    'The clipboard does not contain JSON — copy an exported workspace first.': 'Die Zwischenablage enthält kein JSON — kopieren Sie zuerst einen exportierten Workspace.',
    'The clipboard does not contain an exported workspace.': 'Die Zwischenablage enthält keinen exportierten Workspace.',
    'This workspace was exported by a newer version of the plugin (format {version}).': 'Dieser Workspace wurde von einer neueren Version des Plugins exportiert (Format {version}).',
    'This exported workspace is incomplete.': 'Dieser exportierte Workspace ist unvollständig.',

    // svgSanitizer.ts — sanitizeSvgIcon()
    'The SVG is empty.': 'Das SVG ist leer.',
    'SVG too large (limit: {limit} characters).': 'SVG zu groß (Grenze: {limit} Zeichen).',
    'Invalid SVG, or entirely rejected by sanitisation.': 'Ungültiges SVG oder vollständig durch die Bereinigung verworfen.',
    'The root must be a single <svg> tag.': 'Die Wurzel muss ein einzelnes <svg>-Tag sein.',
    '{count} disallowed element(s) or attribute(s) removed.': '{count} nicht zulässige(s) Element(e) oder Attribut(e) entfernt.',

    // sidebarTree.component.pug — Seitenmenüs "Manage"/"More" (Ordner- und Profilmenü)
    'Manage': 'Verwalten',
    'More': 'Weitere',

    // settingsTab.component.ts — Seitenkopf, dem von Better Vault nachgebildet
    'Enhanced connection sidebar': 'Erweiterte Verbindungs-Seitenleiste',
    'Every block below can be switched off; the sidebar itself can too.': 'Jeder Block unten lässt sich abschalten, die Seitenleiste selbst ebenfalls.',

    // sidebarTree.component.pug — ausgehende Links in der Fußzeile
    'Open the project repository': 'Projekt-Repository öffnen',
    'Open the author profile on GitHub': 'Autorenprofil auf GitHub öffnen',

}

export default de_DE
