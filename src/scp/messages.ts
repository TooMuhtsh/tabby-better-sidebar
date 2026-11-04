/** Feature-scoped labels; do not register a locale before Tabby has loaded it. */
const en = {
    show: 'Show SCP panel', session: 'SSH session', waiting: 'Connect an SSH session to use SCP.',
    path: 'Remote directory', go: 'Go', up: 'Parent directory', refresh: 'Refresh',
    upload: 'Upload file', download: 'Download', cancel: 'Cancel', filter: 'Filter files',
    empty: 'No files to show.', busy: 'Working…', complete: 'Transfer completed.',
    confirm: 'Upload this file? An existing file with the same name will be replaced.',
    missingDialog: 'The native file dialog is not available in this Tabby installation.',
    hint: 'SCP over SSH · POSIX shell required · single-file transfers',
    unavailable: 'This name or file type is not supported by legacy SCP.',
}
const it: typeof en = {
    show: 'Mostra pannello SCP', session: 'Sessione SSH', waiting: 'Apri una sessione SSH per usare SCP.',
    path: 'Cartella remota', go: 'Vai', up: 'Cartella superiore', refresh: 'Aggiorna',
    upload: 'Carica file', download: 'Scarica', cancel: 'Annulla', filter: 'Filtra file',
    empty: 'Nessun file da mostrare.', busy: 'Operazione in corso…', complete: 'Trasferimento completato.',
    confirm: 'Caricare questo file? Un file esistente con lo stesso nome verrà sostituito.',
    missingDialog: 'La finestra di selezione dei file non è disponibile in questa installazione di Tabby.',
    hint: 'SCP tramite SSH · shell POSIX richiesta · trasferimento di singoli file',
    unavailable: 'Nome o tipo di file non supportato dal protocollo SCP classico.',
}
export function scpMessages (locale: string): typeof en {
    return locale.toLowerCase().startsWith('it') ? it : en
}
