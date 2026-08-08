/**
 * Spanish table — keys are the English source strings used in the code.
 * See fr-FR.ts for how these tables are kept in step with the code.
 *
 * Formal register throughout (no "tú"), matching the project's chosen tone.
 */
const es_ES: Record<string, string> = {
    // sftpPanel.component.ts — header line, auto-return-to-Profiles notices
    'SSH session lost ({tab}) — back to Profiles view': 'Sesión SSH perdida ({tab}) — volver a la vista Perfiles',
    'SSH session lost — back to Profiles view': 'Sesión SSH perdida — volver a la vista Perfiles',
    'No more active SSH session — back to Profiles view': 'Ya no hay ninguna sesión SSH activa — volver a la vista Perfiles',

    // sftpPanel.component.pug — freeze toggle, waiting placeholder
    'Frozen view — click to follow focus again': 'Vista fijada — clic para volver a seguir el foco',
    'Freeze view on this session': 'Fijar la vista en esta sesión',
    'Waiting for an active SSH session.': 'Esperando una sesión SSH activa.',
    'Open an SSH profile — the panel will follow the selected tab.': 'Abra un perfil SSH — el panel seguirá la pestaña seleccionada.',

    // sftpBrowser.component.ts — availableColumns / displayToggles
    'Size': 'Tamaño',
    'File size': 'Tamaño del archivo',
    'Date': 'Fecha',
    'Date modified': 'Fecha de modificación',
    'Perm.': 'Perm.',
    'Permissions in octal (755)': 'Permisos en octal (755)',
    'Rights': 'Derechos',
    'Permissions in long form (drwxr-xr-x)': 'Permisos en formato largo (drwxr-xr-x)',
    'Type': 'Tipo',
    'Item type': 'Tipo de elemento',
    'Ext.': 'Ext.',
    'File extension': 'Extensión del archivo',
    'Folders first': 'Carpetas primero',
    'Show hidden files': 'Mostrar archivos ocultos',
    'Column borders': 'Bordes de columna',
    'Alternating rows': 'Filas alternas',

    // sftpBrowser.component.ts — downloadFolder()
    'Destination folder for {name}': 'Carpeta de destino para {name}',
    'Download here': 'Descargar aquí',
    '{name} downloaded to {base}': '{name} descargado en {base}',
    '{name}: incomplete download': '{name}: descarga incompleta',

    // sftpBrowser.component.ts — createFileFromMenu()
    'New file name': 'Nombre del nuevo archivo',
    'The name cannot contain "/"': 'El nombre no puede contener "/"',
    '{name} already exists': '{name} ya existe',
    'Could not create {name}': 'No se pudo crear {name}',

    // sftpBrowser.component.ts — openEntry()
    'Could not follow the link {name}': 'No se pudo seguir el enlace {name}',
    '{name} points to a target that cannot be found': '{name} apunta a un destino que no se puede encontrar',
    '{name} → {target}': '{name} → {target}',

    // sftpBrowser.component.ts — confirmHeavyDirectory()
    'Could not read the contents of {name}': 'No se pudo leer el contenido de {name}',
    '"{name}" contains more than {count} files ({size} at least). Everything will be downloaded before drag-and-drop becomes possible, with no progress and no way to cancel. Continue?':
        '"{name}" contiene más de {count} archivos ({size} como mínimo). Todo se descargará antes de que el arrastrar y soltar sea posible, sin progreso ni forma de cancelar. ¿Continuar?',
    'Download': 'Descargar',

    // sftpBrowser.component.ts — receiveDrop() / resolveDestination()
    'Could not read what was dropped': 'No se pudo leer lo que se soltó',
    '{name} is not a folder — nothing was moved': '{name} no es una carpeta — no se movió nada',
    '{name} is not a folder — sending to {path}': '{name} no es una carpeta — enviando a {path}',

    // sftpBrowser.component.ts — confirmOverwrite()
    '{names}, and {rest, plural, one {# more} other {# more}}': '{names}, y {rest, plural, one {# más} other {# más}}',
    '{count} files already exist under {destination} and will be overwritten: {list}. Continue?':
        '{count} archivos ya existen en {destination} y se sobrescribirán: {list}. ¿Continuar?',
    'A file already exists under {destination} and will be overwritten: {list}. Continue?':
        'Ya existe un archivo en {destination} que se sobrescribirá: {list}. ¿Continuar?',
    'Overwrite': 'Sobrescribir',

    // sftpBrowser.component.ts — reportDrop()
    '{sent, plural, one {# file} other {# files}} sent to {destination} ({folders, plural, one {# folder} other {# folders}})':
        '{sent, plural, one {# archivo enviado} other {# archivos enviados}} a {destination} ({folders, plural, one {# carpeta} other {# carpetas}})',
    '{sent, plural, one {# file} other {# files}} sent to {destination}':
        '{sent, plural, one {# archivo enviado} other {# archivos enviados}} a {destination}',
    '{folders, plural, one {# folder} other {# folders}} created in {destination}':
        '{folders, plural, one {# carpeta creada} other {# carpetas creadas}} en {destination}',
    'Could not send {failed, plural, one {# file} other {# files}} of {total}':
        'No se pudo enviar {failed, plural, one {# archivo} other {# archivos}} de {total}',

    // sftpBrowser.component.ts — askedToLeave()
    'Dragging folders out is disabled — enable it in Settings → Better Sidebar':
        'Arrastrar carpetas hacia fuera está desactivado — actívelo en Ajustes → Better Sidebar',

    // sftpBrowser.component.ts — receiveMove()
    '{name} cannot be moved into itself': '{name} no se puede mover dentro de sí mismo',
    '{name} already exists in {destination}': '{name} ya existe en {destination}',
    'Could not move {name}: {error}': 'No se pudo mover {name}: {error}',
    '{name} moved to {destination}': '{name} movido a {destination}',
    'Could not move {name} to {destination}': 'No se pudo mover {name} a {destination}',
    '{count} items moved to {destination}': '{count} elementos movidos a {destination}',
    'No move succeeded': 'Ningún movimiento se realizó',
    '{succeeded} moved, {failed} failed': '{succeeded} movidos, {failed} fallidos',

    // sftpBrowser.component.ts — showContextMenu()
    'Open with...': 'Abrir con...',
    'Rename...': 'Renombrar...',
    // "Borrar" rather than "Eliminar": the Spanish catalog Tabby already
    // ships translates the "Delete" msgid as "Borrar" (`lint:i18n` flagged
    // the mismatch as ÉCRASE TABBY) — aligned here and kept consistent
    // across every delete-related string below, for terminology
    // consistency.
    'Delete': 'Borrar',
    'Delete selection ({count})': 'Borrar selección ({count})',

    // sftpBrowser.component.ts — renameEntry()
    'New name for "{name}"': 'Nuevo nombre para "{name}"',
    'The name cannot contain "/" — this renames, it does not move': 'El nombre no puede contener "/" — esto renombra, no mueve',
    '{name} already exists in this folder': '{name} ya existe en esta carpeta',
    'Could not rename {name}': 'No se pudo renombrar {name}',
    '{old} renamed to {new}': '{old} renombrado a {new}',

    // sftpBrowser.component.ts — delete confirmations (single + bulk)
    'Delete folder "{name}" and everything in it?': '¿Borrar la carpeta "{name}" y todo su contenido?',
    'Confirm deletion of "{name}"?': '¿Confirmar el borrado de "{name}"?',
    '{name} deleted': '{name} borrado',
    'Could not delete {name}': 'No se pudo borrar {name}',
    'Delete {count} items? This action is irreversible.': '¿Borrar {count} elementos? Esta acción es irreversible.',
    '{name}: {error}': '{name}: {error}',
    '{count} items deleted': '{count} elementos borrados',
    '{succeeded} deleted, {failed} failed': '{succeeded} eliminados, {failed} fallidos',

    // sftpBrowser.component.ts — typeLabel() / rowTooltip()
    'Link': 'Enlace',
    'Folder': 'Carpeta',
    'File': 'Archivo',
    'Size: {size} ({bytes} bytes)': 'Tamaño: {size} ({bytes} bytes)',
    'Modified: {date}': 'Modificado: {date}',
    'Permissions: {octal} — {long}': 'Permisos: {octal} — {long}',
    'Type: {type}': 'Tipo: {type}',
    'Symbolic link': 'Enlace simbólico',

    // sftpBrowser.component.pug — toolbar
    'Double-click to type a path': 'Doble clic para escribir una ruta',
    'Type the path by hand': 'Escribir la ruta manualmente',
    'Refresh': 'Actualizar',
    'Filter the list': 'Filtrar la lista',
    'New remote folder': 'Nueva carpeta remota',
    'Send files to the server': 'Enviar archivos al servidor',
    'Send a folder to the server': 'Enviar una carpeta al servidor',
    'Filter...': 'Filtrar...',
    'Clear the filter': 'Borrar el filtro',

    // sftpBrowser.component.pug — body, grid, sentinel
    'Connecting...': 'Conectando...',
    'Loading...': 'Cargando...',
    'Name': 'Nombre',
    'Go up one level': 'Subir un nivel',
    '… {n} more items': '… {n} elementos más',
    'No file matches the filter.': 'Ningún archivo coincide con el filtro.',

    // sftpBrowser.component.pug — floating menus
    'Create a folder': 'Crear una carpeta',
    'Create a file': 'Crear un archivo',
    'Display settings': 'Ajustes de visualización',
    'Columns': 'Columnas',

    // confirmModal.component.ts/.pug
    'Confirm': 'Confirmar',
    'Cancel': 'Cancelar',

    // noteModal.component.pug
    'Note: {name}': 'Nota — {name}',
    'Restart commands, maintenance reminders, ticket numbers…': 'Comandos de reinicio, recordatorios de mantenimiento, números de ticket…',
    'Clearing the field removes the note.': 'Vaciar el campo elimina la nota.',
    'Save': 'Guardar',

    // pasteGroupModal.component.ts/.pug
    'Paste the folder: {name}': 'Pegar la carpeta — {name}',
    'A folder named <strong>{name}</strong> already exists at the root.': 'Ya existe una carpeta llamada <strong>{name}</strong> en la raíz.',
    'To paste: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'A pegar: {folders, plural, one {# carpeta} other {# carpetas}}, {profiles, plural, one {# perfil} other {# perfiles}}.',
    'Removed from the export: {info}. Re-enter after pasting.': 'Retirado de la exportación: {info}. Debe volver a introducirse tras pegar.',
    'Paste alongside': 'Pegar al lado',
    'A new folder "{name}". Nothing existing is touched.': 'Una nueva carpeta "{name}". Nada de lo existente se modifica.',
    'Merge into the existing folder': 'Fusionar en la carpeta existente',
    'Profiles and subfolders added to "{name}". Duplicates are not detected.': 'Perfiles y subcarpetas añadidos a "{name}". No se detectan los duplicados.',

    // snippetsModal.component.pug
    'Snippets: {name}': 'Snippets — {name}',
    'No snippets.': 'Sin snippets.',
    'Variables and behaviour of this snippet here': 'Variables y comportamiento de este snippet aquí',
    'Remove from here: stays in the library': 'Quitar de aquí — permanece en la biblioteca',
    'Detach': 'Desvincular',
    'Variables': 'Variables',
    'Required, not filled in.': 'Obligatoria, sin rellenar.',
    '"{value}" contains a space and is not quoted. Write "{token}" in the command, or quote the value here.':
        '"{value}" contiene un espacio y no está entre comillas. Escriba "{token}" en el comando, o ponga el valor entre comillas aquí.',
    'Behaviour': 'Comportamiento',
    'On click': 'Al hacer clic',
    'Follow (run)': 'Seguir (ejecutar)',
    'Follow (write)': 'Seguir (escribir)',
    'Write without confirming': 'Escribir sin confirmar',
    'Write and run': 'Escribir y ejecutar',
    'Without a session': 'Sin sesión',
    'Follow (launch)': 'Seguir (lanzar)',
    'Follow (do nothing)': 'Seguir (no hacer nada)',
    'Do nothing': 'No hacer nada',
    'Launch the session': 'Lanzar la sesión',
    'Wait': 'Espera',
    'to fill in': 'a rellenar',
    'follow': 'seguir',
    'Inherited': 'Heredados',
    'Reactivate here': 'Reactivar aquí',
    'No longer offer here: stays attached to the folder': 'Dejar de ofrecer aquí — permanece vinculado a la carpeta',
    'Reactivate': 'Reactivar',
    'Disable here': 'Desactivar aquí',
    'Available snippets': 'Snippets disponibles',
    'Attach here': 'Vincular aquí',
    'Attach': 'Vincular',
    'Inherit (run)': 'Heredar (ejecutar)',
    'Inherit (write)': 'Heredar (escribir)',
    'Inherit (launch)': 'Heredar (lanzar)',
    'Inherit (do nothing)': 'Heredar (no hacer nada)',
    'Inherited from the content of the folder.': 'Heredado del contenido de la carpeta.',
    'Manage the library': 'Gestionar la biblioteca',
    'Close': 'Cerrar',

}

export default es_ES
