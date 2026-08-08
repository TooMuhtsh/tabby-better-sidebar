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

}

export default de_DE
