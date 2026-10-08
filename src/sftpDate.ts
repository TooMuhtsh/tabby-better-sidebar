/**
 * How the SFTP browser writes a modification date — the `sftpDateFormat`
 * setting.
 *
 * `locale` is what the panel always did: whatever Tabby's language says, which
 * is day-first in French or Spanish, `8.10.2026` in German and month-first in
 * English. The other two are fixed shapes for anyone who wants the same date
 * whatever the language (issue #11). Both are written by hand rather than
 * through `Intl` with a forced locale: no locale is guaranteed to keep its
 * current punctuation, and a shape that is the whole point of the setting
 * should not depend on one.
 *
 * Local time throughout, like `toLocaleString()` — the listing shows the time
 * of the machine reading it, never UTC.
 */
export type SftpDateFormat = 'locale'|'dmy'|'iso'

/** Anything else read from `config.yaml` (hand-edited, or written by a newer version) falls back to the default rather than to an empty cell. */
export function normalizeSftpDateFormat (value: unknown): SftpDateFormat {
    return value === 'dmy' || value === 'iso' ? value : 'locale'
}

function pad (value: number, width = 2): string {
    return String(value).padStart(width, '0')
}

/** Date only, for the column: `08/10/2026`, `2026-10-08`, or the locale's own short form. */
export function formatSftpDate (date: Date, format: SftpDateFormat, locale: string): string {
    const day = pad(date.getDate())
    const month = pad(date.getMonth() + 1)
    const year = pad(date.getFullYear(), 4)
    switch (format) {
        case 'dmy': return `${day}/${month}/${year}`
        case 'iso': return `${year}-${month}-${day}`
        default: return date.toLocaleDateString(locale)
    }
}

/** Date and time, for the row tooltip: the column's date followed by a 24-hour `HH:mm:ss`, or `toLocaleString()` untouched for `locale`. */
export function formatSftpDateTime (date: Date, format: SftpDateFormat, locale: string): string {
    if (format === 'locale') {
        return date.toLocaleString(locale)
    }
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    return `${formatSftpDate(date, format, locale)} ${time}`
}
