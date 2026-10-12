/** Strict calendar dates used by FDA feeds, without JavaScript rollover. */
export function parseFdaDate(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const iso = calendarText(raw);
  if (iso === null) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

function calendarText(raw: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(raw) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match !== null) return `${match[1] ?? ''}-${match[2] ?? ''}-${match[3] ?? ''}`;
  // FDA shortage dates use MM/DD/YYYY; NDC listing dates use YYYYMMDD.
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  return us === null ? null : `${us[3] ?? ''}-${us[1] ?? ''}-${us[2] ?? ''}`;
}
