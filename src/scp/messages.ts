/** Feature-scoped labels; do not register a locale before Tabby has loaded it. */
const en = {
    show: 'Show SCP panel', session: 'SSH session', waiting: 'Connect an SSH session to use SCP.',
    path: 'Remote directory', go: 'Go', up: 'Parent directory', refresh: 'Refresh',
    upload: 'Upload files', uploadFolder: 'Upload folder', download: 'Download', cancel: 'Cancel', filter: 'Filter files',
    empty: 'No files to show.', busy: 'Working…', complete: 'Transfer completed.',
    confirm: 'Upload these items? Folders will be merged and existing files with the same name will be replaced.',
    missingDialog: 'The native file dialog is not available in this Tabby installation.',
    hint: 'SCP over SSH · POSIX shell required · drop local files/folders here or on a folder',
    unavailable: 'This name or file type is not supported by legacy SCP.',
    skipped: 'Skipped symbolic links / special files:',
    dropUnavailable: 'Cannot read all dropped paths. Use Upload files or Upload folder instead.',
    duplicate: 'Several selected items have the same destination name.',
}
const it: typeof en = {
    show: 'Mostra pannello SCP', session: 'Sessione SSH', waiting: 'Apri una sessione SSH per usare SCP.',
    path: 'Cartella remota', go: 'Vai', up: 'Cartella superiore', refresh: 'Aggiorna',
    upload: 'Carica file', uploadFolder: 'Carica cartella', download: 'Scarica', cancel: 'Annulla', filter: 'Filtra file',
    empty: 'Nessun file da mostrare.', busy: 'Operazione in corso…', complete: 'Trasferimento completato.',
    confirm: 'Caricare questi elementi? Le cartelle verranno unite e i file esistenti con lo stesso nome saranno sostituiti.',
    missingDialog: 'La finestra di selezione dei file non è disponibile in questa installazione di Tabby.',
    hint: 'SCP tramite SSH · shell POSIX richiesta · trascina qui file/cartelle locali o su una cartella',
    unavailable: 'Nome o tipo di file non supportato dal protocollo SCP classico.',
    skipped: 'Link simbolici / file speciali saltati:',
    dropUnavailable: 'Impossibile leggere tutti i percorsi trascinati. Usa Carica file o Carica cartella.',
    duplicate: 'Più elementi selezionati hanno lo stesso nome di destinazione.',
}
export function scpMessages (locale: string): typeof en {
    return locale.toLowerCase().startsWith('it') ? it : en
}
