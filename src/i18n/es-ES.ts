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

    // transfers.component.pug — header, per-row states and tooltips (lot 3)
    'Transfers': 'Transferencias',
    'Clear the list — running transfers will be cancelled': 'Vaciar la lista — las transferencias en curso se cancelarán',
    'Transfer finished — the system is still placing the file at its destination. The shown duration is an estimate: nothing signals when this copy ends.': 'Transferencia terminada — el sistema termina de colocar el archivo en su destino. La duración mostrada es una estimación: nada señala el final de esta copia.',
    'handing over to the system…': 'entrega al sistema…',
    'cancelled': 'cancelada',
    'interrupted at {percent} %': 'interrumpida al {percent} %',
    'incomplete at destination': 'incompleta en destino',
    'Estimated time remaining': 'Tiempo restante estimado',
    'Elapsed time': 'Tiempo transcurrido',
    'Cancel this transfer and remove it': 'Cancelar esta transferencia y quitarla',
    'Remove from the list': 'Quitar de la lista',

    // transfers.component.ts — confirmations
    'Cancel "{name}" while it is running?': '¿Cancelar « {name} » en curso?',
    'Cancel the transfer': 'Cancelar la transferencia',
    'One transfer is still running. Clearing the list will cancel it. Continue?': 'Una transferencia sigue en curso. Vaciar la lista la cancelará. ¿Continuar?',
    '{count} transfers are still running. Clearing the list will cancel them. Continue?': '{count} transferencias siguen en curso. Vaciar la lista las cancelará. ¿Continuar?',
    'Clear and cancel': 'Vaciar y cancelar',

    // transfersRegistry.service.ts — badge, breakdown tooltip, row tooltip
    'Session: {label}': 'Sesión: {label}',
    '{count} running': '{count} en curso',
    '{count, plural, one {# finished} other {# finished}}': '{count, plural, one {# terminada} other {# terminadas}}',
    '{count, plural, one {# cancelled} other {# cancelled}}': '{count, plural, one {# cancelada} other {# canceladas}}',
    '{count, plural, one {# interrupted} other {# interrupted}}': '{count, plural, one {# interrumpida} other {# interrumpidas}}',
    '{count, plural, one {# incomplete at destination} other {# incomplete at destination}}': '{count, plural, one {# incompleta en destino} other {# incompletas en destino}}',

    // sidebarTree.component.pug — view tabs, live sessions, recents, tunnels (lot 3)
    'Profiles': 'Perfiles',
    'SFTP of the active session': 'SFTP de la sesión activa',
    'Active sessions': 'Sesiones activas',
    'Open the SFTP of this session': 'Abrir el SFTP de esta sesión',
    'Recently launched': 'Recientes',
    'Active tunnels': 'Túneles activos',
    'resuming…': 'reanudando…',
    'not restored': 'no restablecido',
    'Open {url} in the browser': 'Abrir {url} en el navegador',
    'Go to the session': 'Ir a la sesión',

    // sidebarTree.component.pug — workspace bar, filter, selection, hidden items
    'All': 'Todos',
    'New workspace': 'Nuevo espacio de trabajo',
    'Filter (Ctrl+F)': 'Filtrar (Ctrl+F)',
    'Hidden items in this workspace': 'Elementos ocultos en este espacio de trabajo',
    '{count, plural, one {# profile selected} other {# profiles selected}}': '{count, plural, one {# perfil seleccionado} other {# perfiles seleccionados}}',
    'Clear the selection': 'Cancelar la selección',
    'Drag the selection, or right-click the destination folder': 'Arrastre la selección o haga clic derecho en la carpeta de destino',
    'No hidden items in this workspace.': 'Ningún elemento oculto en este espacio de trabajo.',
    'Show again': 'Volver a mostrar',

    // sidebarTree.component.pug — profile row badges
    'Connected': 'Conectado',
    'Disconnected': 'Desconectado',
    'No session': 'Ninguna sesión',
    '{count} tunnel(s) mounted on this session': '{count} túnel(es) montado(s) en esta sesión',
    '{count} tunnel(s) configured: mounted when the session launches': '{count} túnel(es) configurado(s): se montan al iniciar la sesión',
    'Upload in progress': 'Envío en curso',
    'Download in progress': 'Recepción en curso',

    // sidebarTree.component.pug — context menus
    'Move the selection here ({count})': 'Mover la selección aquí ({count})',
    'Launch all sessions': 'Iniciar todas las sesiones',
    'Edit the note...': 'Editar la nota...',
    'Add a note...': 'Añadir una nota...',
    'Remove from favorites': 'Quitar de favoritos',
    'Add to favorites': 'Añadir a favoritos',
    'New folder...': 'Nueva carpeta...',
    'New profile...': 'Nuevo perfil...',
    'Change the icon...': 'Cambiar el icono...',
    'Copy the structure (JSON)': 'Copiar la estructura (JSON)',
    'Copy without credentials': 'Copiar sin las credenciales',
    'Hide in this workspace': 'Ocultar en el espacio de trabajo',
    'Paste the folder': 'Pegar el grupo',
    'Profile tunnels...': 'Túneles del perfil...',
    'Edit...': 'Editar...',
    'Duplicate': 'Duplicar',

    // sidebarTree.component.pug — icon picker
    'Choose an icon': 'Elegir un icono',
    'Remove the icon': 'Quitar el icono',
    'Favorites': 'Favoritos',
    'Right-click an icon: "Add to favorites"': 'Clic derecho en un icono → «Añadir a favoritos»',
    'Recently used': 'Recientes',
    'Search (e.g. server, folder, star...)': 'Buscar (ej.: server, folder, star...)',
    'Import from an SVG...': 'Importar desde un SVG...',
    'Apply the SVG': 'Aplicar el SVG',

    // sidebarTree.component.pug — icon picker, dashboard-icons variant dots
    'Default variant': 'Variante predeterminada',
    'Light variant': 'Variante clara',
    'Dark variant': 'Variante oscura',

    // sidebarTree.component.pug — rename/create popups
    'Rename': 'Renombrar',
    'New folder': 'Nueva carpeta',
    'Folder name': 'Nombre de la carpeta',
    'Create': 'Crear',

    // sidebarTree.component.pug — profile tunnels popup
    'Tunnels: {name}': 'Túneles — {name}',
    'No tunnels configured on this profile.': 'Ningún túnel configurado en este perfil.',
    'Double-click to edit this tunnel': 'Doble clic para editar este túnel',
    'Delete this tunnel': 'Eliminar este túnel',
    'This tunnel is currently mounted on the open session. Deleting it here would remove its configuration without cutting the tunnel, which would keep running until the session closes. Close the session to be able to delete it.':
        'Este túnel está montado en la sesión abierta. Eliminarlo aquí quitaría su configuración sin cortar el túnel, que seguiría funcionando hasta el cierre de la sesión. Cierre la sesión para poder eliminarlo.',
    'Listening port': 'Puerto de escucha',
    'Target host': 'Host de destino',
    'Target port': 'Puerto de destino',
    'Description (optional)': 'Descripción (opcional)',
    'Add the tunnel': 'Añadir el túnel',
    'Takes effect at the next session launch.': 'Surte efecto en el próximo inicio de la sesión.',

    // sidebarTree.component.pug — profile/workspace popups, footer
    'New profile': 'Nuevo perfil',
    'Delete the profile': 'Eliminar el perfil',
    'Delete "{name}"? This action is irreversible.': '¿Eliminar «{name}»? Esta acción es irreversible.',
    'Icon...': 'Icono...',
    'Color...': 'Color...',
    'Copy (JSON)': 'Copiar (JSON)',
    'Manage this workspace': 'Gestionar este espacio de trabajo',
    'New workspace...': 'Nuevo espacio de trabajo...',
    'Workspace name': 'Nombre del espacio de trabajo',
    'Import from the clipboard': 'Importar del portapapeles',
    'Rename the workspace': 'Renombrar el espacio de trabajo',
    'Workspace color': 'Color del espacio de trabajo',
    'Remove the color': 'Quitar el color',
    'Delete the workspace': 'Eliminar el espacio de trabajo',
    'Delete "{name}"? Hidden profiles and folders become visible everywhere else. This action is irreversible.':
        '¿Eliminar «{name}»? Los perfiles y carpetas ocultos vuelven a ser visibles en el resto. Esta acción es irreversible.',
    'Better Sidebar settings': 'Ajustes de Better Sidebar',

    // sidebarTree.component.ts — snippets notices, workspaces, pinned group
    'Variables to fill in on "{name}"': 'Variables por rellenar en «{name}»',
    '{detail}: right-click the profile, "Snippets", then the snippet settings button.': '{detail}: clic derecho en el perfil, «Snippets…» y luego el botón de ajustes del snippet.',
    'This folder contains no profile to launch': 'Esta carpeta no contiene ningún perfil que iniciar',
    'The clipboard does not hold an exported workspace.': 'El portapapeles no contiene un espacio de trabajo exportado.',
    'Imported workspace': 'Espacio de trabajo importado',
    'Workspace "{name}" imported.': 'Espacio de trabajo «{name}» importado.',
    'Workspace "{name}" copied.': 'Espacio de trabajo «{name}» copiado.',
    'Pinned': 'Anclados',
    '"{name}" expects a value': '«{name}» espera un valor',
    '{list}: to fill in under "Snippets".': '{list}: por rellenar en «Snippets…».',
    '"{name}" has no open session': '«{name}» no tiene una sesión abierta',
    'The session of "{name}" did not open': 'La sesión de «{name}» no se abrió',

    // sidebarTree.component.ts — session tooltips, uptime units (only the day unit varies)
    'Transfers: {count} running, total speed {speed}': 'Transferencias: {count} en curso, velocidad total {speed}',
    'Transfers: {count} running': 'Transferencias: {count} en curso',
    '{d}d {h}h': '{d}d {h}h',
    '{d} d {h} h': '{d} d {h} h',

    // sidebarTree.component.ts — tunnels (rows, hints, editor)
    '{detail}: session cut, tunnel waiting to resume': '{detail}: sesión cortada, túnel a la espera de reanudación',
    '{detail}: not restored after the reconnection. Only the tunnels saved in the profile are remounted; a tunnel added on the fly disappears with its session.':
        '{detail}: no restablecido tras la reconexión. Solo se vuelven a montar los túneles guardados en el perfil; un túnel añadido sobre la marcha desaparece con la sesión.',
    'Tunnel {detail} already mounted by {owner}: duplicate dismounted ({session})': 'Túnel {detail} ya montado por {owner}: duplicado desmontado ({session})',
    'Listens on the remote server. The destination is resolved from your PC.': 'Escucha en el servidor remoto. El destino se resuelve desde su PC.',
    'Opens a SOCKS proxy on your PC, with no fixed destination.': 'Abre un proxy SOCKS en su PC, sin destino fijo.',
    'Listens on your PC. The destination is resolved from the server, so "localhost" there means the server.':
        'Escucha en su PC. El destino se resuelve desde el servidor: «localhost» designa allí al servidor.',
    'Enter a listening port.': 'Indique un puerto de escucha.',
    'Enter the destination host and port.': 'Indique el host y el puerto de destino.',
    'Tunnel updated': 'Túnel modificado',
    'Tunnel saved': 'Túnel guardado',
    'The current session keeps the old one until it is relaunched.': 'La sesión en curso conserva el anterior hasta que se reinicie.',
    'It will be mounted at the next launch of this session.': 'Se montará en el próximo inicio de esta sesión.',
    'This tunnel is mounted on the current session. Close the session to be able to delete it.': 'Este túnel está montado en la sesión en curso. Cierre la sesión para poder eliminarlo.',

    // sidebarTree.component.ts — selection moves, folder ops, sharing
    'No group': 'Sin grupo',
    '{count} profiles moved to "{where}"': '{count} perfiles movidos a «{where}»',
    'Profile moved to "{where}"': 'Perfil movido a «{where}»',
    'Moving the folder failed': 'No se pudo mover la carpeta',
    'SVG rejected.': 'SVG rechazado.',
    'No provider handles "{name}": opening the settings': 'Ningún proveedor gestiona «{name}»: se abren los ajustes',
    '{name} - Copy': '{name} - Copia',
    'Folder "{name}" copied: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Carpeta «{name}» copiada: {folders, plural, one {# carpeta} other {# carpetas}}, {profiles, plural, one {# perfil} other {# perfiles}}.',
    'Removed: {purged}.': 'Retirado: {purged}.',
    'The clipboard does not hold a shared folder.': 'El portapapeles no contiene una carpeta compartida.',
    'Pasted folder': 'Carpeta pegada',
    'Folder "{name}" pasted: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        'Carpeta «{name}» pegada: {folders, plural, one {# carpeta} other {# carpetas}}, {profiles, plural, one {# perfil} other {# perfiles}}.',
    'Removed at export: {purged}. To be re-entered.': 'Retirado al exportar: {purged}. Por reintroducir.',
    '{count, plural, one {Profile type not installed} other {Profile types not installed}}: {list}.':
        '{count, plural, one {Tipo de perfil no instalado} other {Tipos de perfil no instalados}}: {list}.',
    'This JSON still carried secrets its own header declared removed.': 'Este JSON aún contenía secretos que su propia cabecera declaraba retirados.',
    'Removed at paste: {purged}.': 'Retirado al pegar: {purged}.',
    '{count, plural, one {# subfolder} other {# subfolders}}': '{count, plural, one {# subcarpeta} other {# subcarpetas}}',
    '{count, plural, one {# profile} other {# profiles}}': '{count, plural, one {# perfil} other {# perfiles}}',
    '{a} and {b}': '{a} y {b}',
    'current': 'actual',
    'This content is hidden in the workspace "{name}".': 'Este contenido está oculto en el espacio de trabajo «{name}».',
    'Cannot delete "{name}"': 'No se puede eliminar «{name}»',
    'This folder still contains {reasons}.{hint} Empty it first.': 'Esta carpeta aún contiene {reasons}.{hint} Vacíela primero.',

    // settingsTab.component.ts — nav + general page
    'General': 'General',
    'Features': 'Funciones',
    'Show the sidebar': 'Mostrar la barra lateral',
    'Removes the sidebar without uninstalling anything.': 'Quita la barra lateral sin desinstalar nada.',
    'Untick to hide it; this page stays reachable.': 'Desmarque para ocultarla; esta página sigue accesible.',
    'Hide the Tabby transfers menu': 'Ocultar el menú de transferencias de Tabby',
    'Otherwise the native Tabby menu opens on every transfer.': 'Si no, el menú nativo de Tabby se abre en cada transferencia.',
    'The sidebar panel already shows the same transfers.': 'El panel de la barra lateral ya muestra las mismas transferencias.',

    // settingsTab.component.ts — features page
    'Each block switches on independently. Nothing is deleted by turning one off.': 'Cada bloque se activa de forma independiente. No se borra nada al apagarlo.',
    'Mirrors the state of Tabby port forwarding.': 'Refleja el estado del reenvío de puertos de Tabby.',
    'Port forwarding panel and badges on the profiles.': 'Panel de redirecciones de puertos e insignias en los perfiles.',
    'Unavailable on this version of Tabby. Your setting is kept.': 'No disponible en esta versión de Tabby. Su ajuste se conserva.',
    'Workspaces': 'Espacios de trabajo',
    '"All" excludes nothing; the filter bar searches everywhere.': '«Todos» no excluye nada; la barra de filtrado busca en todas partes.',
    'Workspace bar, above the list.': 'Barra de espacios de trabajo, encima de la lista.',
    'Presentation': 'Presentación',
    'Tabs or a compact list, as you prefer.': 'Pestañas o lista compacta, a elegir.',
    'Changes how the workspace bar is displayed.': 'Cambia la presentación de la barra de espacios de trabajo.',
    'Tabs (wrap onto new lines)': 'Pestañas (pasan de línea)',
    'Dropdown list': 'Lista desplegable',
    'Filter bar': 'Barra de filtrado',
    'Searches the name, description, host and username.': 'Busca el nombre, la descripción, el host y el usuario.',
    'Search field and shortcut': 'Campo de búsqueda y atajo',
    'A library of commands attached to profiles and folders.': 'Biblioteca de comandos asociados a perfiles y carpetas.',
    'The "Snippets" entry of the right click and its dedicated tab.': 'Entrada «Snippets…» del clic derecho y pestaña dedicada.',
    'Notes': 'Notas',
    'A free-form memo per profile or folder.': 'Una nota libre por perfil o carpeta.',
    'The "note" entry of the right click and its badge.': 'Entrada «nota» del clic derecho e insignia asociada.',
    'Recent profiles': 'Perfiles recientes',
    'The 5 most recently launched profiles, all types together.': 'Los 5 últimos perfiles iniciados, de todos los tipos.',
    'A list shown under the active sessions.': 'Lista mostrada bajo las sesiones activas.',
    'One row per pane, not per tab.': 'Una línea por panel, no por pestaña.',
    'Open SSH connections, at the top of the sidebar.': 'Conexiones SSH abiertas, en la parte superior de la barra lateral.',
    'Latency probe, in seconds': 'Medición de latencia, en segundos',
    'A real SFTP round trip, not an ICMP ping.': 'Ida y vuelta SFTP real, no un ping ICMP.',
    'Colors the dot of each session. 0 disables.': 'Colorea el punto de cada sesión. 0 desactiva.',

    // settingsTab.component.ts — SFTP block
    'SFTP view': 'Vista SFTP',
    'One SFTP channel per session actually browsed.': 'Un canal SFTP por sesión realmente explorada.',
    'The SFTP tab of the sidebar and its panel.': 'Pestaña SFTP de la barra lateral y su panel.',
    'Remote file editor': 'Editor de archivos remotos',
    'The file is copied, edited, then sent back to the server.': 'El archivo se copia, se edita y se reenvía al servidor.',
    'Program opened on double-click. Empty, Windows decides.': 'Programa abierto con doble clic. Vacío, decide Windows.',
    'No editor chosen': 'Ningún editor elegido',
    'Browse...': 'Examinar...',
    'Erase': 'Borrar',
    'Drag a folder out to Explorer': 'Arrastrar una carpeta al Explorador',
    'The folder is downloaded in full before the drop.': 'La carpeta se descarga entera antes de soltarla.',
    'Beyond 25 files or 20 MB, confirmation is asked.': 'Más allá de 25 archivos o 20 MB, se pide confirmación.',
    'Automatic refresh, in seconds': 'Actualización automática, en segundos',
    'Only changed entries are redrawn.': 'Solo se redibujan las entradas modificadas.',
    '0 disables; every cycle re-reads the folder.': '0 desactiva; cada ciclo relee la carpeta.',
    'Return to Profiles when no SSH session is open any more': 'Volver a Perfiles cuando ya no queda ninguna sesión SSH abierta',
    'Also covers the waiting screen of the SFTP panel.': 'Cubre también la pantalla de espera del panel SFTP.',
    'Waits for the grace period of the displayed session to end.': 'Espera al final del periodo de gracia de la sesión mostrada.',
    'Deletion: button activated by Enter': 'Eliminación: botón activado con Intro',
    'No deletion can be undone afterwards.': 'Ninguna eliminación se puede deshacer después.',
    'Applies to': 'Se aplica a',
    'and to the right click.': 'y al clic derecho.',
    'always cancels.': 'siempre cancela.',
    'Del': 'Supr',
    'Esc': 'Esc',
    'Cancel: the safe answer (default)': 'Cancelar: la respuesta segura (por defecto)',
    'Delete: Del then Enter in one gesture': 'Eliminar: Supr y luego Intro en un gesto',
    'Transfer manager': 'Gestor de transferencias',
    'Also mirrors the transfers of the native SFTP panel.': 'Refleja también las transferencias del panel SFTP nativo.',
    'Panel shown at the bottom of the sidebar.': 'Panel mostrado en la parte inferior de la barra lateral.',

    // settingsTab.component.ts — snippet library
    'A command written once, usable everywhere it is attached.': 'Un comando escrito una vez, utilizable allí donde esté asociado.',
    'No snippets yet.': 'Ningún snippet por ahora.',
    '{count} snippet(s) attached to nothing.': '{count} snippet(s) sin asociar a nada.',
    'Detached from the sidebar, they stay here until deleted.': 'Desvinculados desde la barra lateral, permanecen aquí hasta su eliminación.',
    'attached to {count} item(s)': 'asociado a {count} elemento(s)',
    'attached nowhere': 'sin asociar',
    'Modify': 'Editar',
    'New snippet': 'Nuevo snippet',
    'What the context menu shows.': 'Lo que muestra el menú contextual.',
    'Restart nginx': 'Reiniciar nginx',
    'Command': 'Comando',
    'Use': 'Utilice',
    'for a required value, or': 'para un valor requerido, o',
    'for a default value.': 'para un valor por defecto.',
    'Changes the command on the {count} existing attachment(s).': 'Modifica el comando en los {count} vínculo(s) existentes.',
    'Delete the snippet "{name}"? It is attached to {count} item(s), which will lose it.': '¿Eliminar «{name}»? Está asociado a {count} elemento(s), que lo perderán.',
    'Delete the snippet "{name}"?': '¿Eliminar «{name}»?',

    // profileModal.ts — PROFILE_MODAL_UNAVAILABLE
    'The Tabby profile window has changed — profile creation and editing are unavailable in this version':
        'La ventana de perfil de Tabby ha cambiado — creación y edición de perfiles no disponibles en esta versión',

    // groupShare.ts — parsePayload() errors, describePurge() clauses
    'The clipboard is empty.': 'El portapapeles está vacío.',
    'The clipboard content is too large to be a shared folder.': 'El contenido del portapapeles es demasiado grande para ser una carpeta compartida.',
    'The clipboard does not contain JSON — copy a folder from the sidebar first.': 'El portapapeles no contiene JSON — copie antes una carpeta desde la barra lateral.',
    'The clipboard does not contain a shared folder.': 'El portapapeles no contiene una carpeta compartida.',
    'This JSON was not produced by "Copy the structure" from this sidebar.': 'Este JSON no fue generado por «Copiar la estructura» desde esta barra lateral.',
    'This folder was exported by a newer version of the plugin (format {version}).': 'Esta carpeta fue exportada por una versión más reciente del plugin (formato {version}).',
    'This shared folder is incomplete: it contains no group.': 'Esta carpeta compartida está incompleta: no contiene ningún grupo.',
    '{count, plural, one {# password} other {# passwords}}': '{count, plural, one {# contraseña} other {# contraseñas}}',
    '{count, plural, one {# login script} other {# login scripts}}': '{count, plural, one {# script de inicio de sesión} other {# scripts de inicio de sesión}}',
    '{count, plural, one {# vault key} other {# vault keys}}': '{count, plural, one {# clave de la caja fuerte} other {# claves de la caja fuerte}}',
    '{count, plural, one {# key path} other {# key paths}}': '{count, plural, one {# ruta de clave} other {# rutas de clave}}',
    '{count, plural, one {# credential} other {# credentials and routes}}': '{count, plural, one {# credencial} other {# credenciales y rutas}}',
    '{count, plural, one {# sensitive field} other {# sensitive fields}}': '{count, plural, one {# campo sensible} other {# campos sensibles}}',
    '{count, plural, one {# proxy command} other {# proxy commands}}': '{count, plural, one {# comando proxy} other {# comandos proxy}}',
    '{count, plural, one {# unrecognised option} other {# unrecognised options}}': '{count, plural, one {# opción no reconocida} other {# opciones no reconocidas}}',
    '{count, plural, one {# profile of an unsupported type} other {# profiles of an unsupported type}}': '{count, plural, one {# perfil de tipo no compatible} other {# perfiles de tipo no compatible}}',

    // workspaceShare.ts — parseWorkspacePayload() errors
    'The clipboard content is too large to be an exported workspace.': 'El contenido del portapapeles es demasiado grande para ser un workspace exportado.',
    'The clipboard does not contain JSON — copy an exported workspace first.': 'El portapapeles no contiene JSON — copie antes un workspace exportado.',
    'The clipboard does not contain an exported workspace.': 'El portapapeles no contiene un workspace exportado.',
    'This workspace was exported by a newer version of the plugin (format {version}).': 'Este workspace fue exportado por una versión más reciente del plugin (formato {version}).',
    'This exported workspace is incomplete.': 'Este workspace exportado está incompleto.',

    // svgSanitizer.ts — sanitizeSvgIcon()
    'The SVG is empty.': 'El SVG está vacío.',
    'SVG too large (limit: {limit} characters).': 'SVG demasiado grande (límite: {limit} caracteres).',
    'Invalid SVG, or entirely rejected by sanitisation.': 'SVG no válido, o completamente rechazado por la sanitización.',
    'The root must be a single <svg> tag.': 'La raíz debe ser una única etiqueta <svg>.',
    '{count} disallowed element(s) or attribute(s) removed.': '{count} elemento(s) o atributo(s) no permitido(s) eliminados.',

    // sidebarTree.component.pug — submenús laterales "Manage"/"More" (menús de carpeta y de perfil)
    'Manage': 'Gestionar',
    'More': 'Más',

    // settingsTab.component.ts — encabezado de la página, calcado de Better Vault
    'Enhanced connection sidebar': 'Barra lateral de conexiones ampliada',
    'Every block below can be switched off; the sidebar itself can too.': 'Cada bloque siguiente se puede desactivar; la barra lateral también.',

    // sidebarTree.component.pug — enlaces salientes del pie de página
    'Open the project repository': 'Abrir el repositorio del proyecto',
    'Open the author profile on GitHub': 'Abrir el perfil del autor en GitHub',

}

export default es_ES
