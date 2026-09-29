/** Date helpers on ISO calendar dates (YYYY-MM-DD), always in UTC so results never depend on the machine. */
const DAY = 86_400_000;

export function toDays(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
}

export function fromDays(days: number): string {
  return new Date(days * DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromDays(toDays(iso) + n);
}

/** Add calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number, anchorDay?: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const day = Math.min(anchorDay ?? d, last);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function daysBetween(a: string, b: string): number {
  return toDays(b) - toDays(a);
}

/** The last `n` month keys ending with the month of `iso`, oldest first. */
export function lastMonths(iso: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(addMonths(`${monthKey(iso)}-01`, -i)));
  return out;
}
