const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Steam's release_date is free-text (e.g. "9 Sep, 2026", "Sep 2026", "2026",
 * "Coming soon", "To be announced"). Postgres `date` columns reject anything
 * that isn't a real date, which would fail the whole Store upsert. Accept the
 * common date shapes and coerce to ISO YYYY-MM-DD; return null for junk.
 */
export function parseReleaseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // Already ISO yyyy-mm-dd.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const matches = s.match(/(\d{1,2})\s+([A-Za-z]{3,})[,\s]*(\d{4})/); // "9 Sep, 2026"
  if (matches) {
    const m = MONTHS[matches[2].slice(0, 3).toLowerCase()];
    if (m) return `${matches[3]}-${m}-${matches[1].padStart(2, '0')}`;
  }

  const yearOnly = s.match(/^(\d{4})$/); // "2026"
  if (yearOnly) return `${yearOnly[1]}-01-01`;

  const monthYear = s.match(/^([A-Za-z]{3,})[,\s]*(\d{4})$/); // "Sep 2026"
  if (monthYear) {
    const m = MONTHS[monthYear[1].slice(0, 3).toLowerCase()];
    if (m) return `${monthYear[2]}-${m}-01`;
  }

  return null; // "To be announced", "Coming soon", empty, etc.
}
