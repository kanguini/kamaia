/**
 * Business-day arithmetic for Angolan legal calendar.
 *
 * A "business day" is any weekday (Mon–Fri) that isn't a public holiday.
 * This utility layer is framework-agnostic — it takes a pre-loaded set of
 * holiday dates (ISO YYYY-MM-DD) so the service can decide whether to hit
 * the DB, cache, or a test stub.
 */

const MS_PER_DAY = 86_400_000;

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function atMidnightUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(d: Date, holidayKeys: Set<string>): boolean {
  if (isWeekend(d)) return false;
  return !holidayKeys.has(toKey(d));
}

/**
 * Returns the date exactly `n` business days after `start` (exclusive of
 * `start` itself unless `start` is non-business and we need to roll).
 * Example: start Friday + 3 business days → next Wednesday.
 */
export function addBusinessDays(
  start: Date,
  n: number,
  holidayKeys: Set<string>,
): Date {
  const cursor = atMidnightUtc(start);
  let remaining = n;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidayKeys)) remaining--;
  }
  return cursor;
}

/**
 * Rolls `d` forward to the next business day if it isn't one already.
 * Used when a legal deadline "cai num sábado" — the actual deadline
 * shifts to the next business day.
 */
export function rollForwardIfNonBusiness(
  d: Date,
  holidayKeys: Set<string>,
): Date {
  const cursor = atMidnightUtc(d);
  while (!isBusinessDay(cursor, holidayKeys)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor;
}

export function countBusinessDaysBetween(
  start: Date,
  end: Date,
  holidayKeys: Set<string>,
): number {
  const s = atMidnightUtc(start);
  const e = atMidnightUtc(end);
  if (e <= s) return 0;
  let count = 0;
  for (let t = s.getTime() + MS_PER_DAY; t <= e.getTime(); t += MS_PER_DAY) {
    if (isBusinessDay(new Date(t), holidayKeys)) count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────
// Angolan public holidays (national)
// Source: Lei n.º 16/96 + actualizações (4/abril, 17/setembro,
// Dia Internacional da Mulher 8/mar adoptado como feriado).
// Easter-based: Carnaval = Mon before Ash Wednesday = Easter - 48;
//               Sexta-Feira Santa = Easter - 2.
// ─────────────────────────────────────────────────────────────

/** Gregorian Easter Sunday for the given year. */
export function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export interface AngolaHoliday {
  name: string;
  date: Date;
  recurring: boolean;
  kind: 'NATIONAL' | 'RELIGIOUS';
}

export function getAngolanHolidays(year: number): AngolaHoliday[] {
  const fixed: Array<{ m: number; d: number; name: string; kind: AngolaHoliday['kind'] }> = [
    { m: 1, d: 1, name: 'Ano Novo', kind: 'NATIONAL' },
    { m: 2, d: 4, name: 'Dia do Início da Luta Armada', kind: 'NATIONAL' },
    { m: 3, d: 8, name: 'Dia Internacional da Mulher', kind: 'NATIONAL' },
    { m: 4, d: 4, name: 'Dia da Paz e Reconciliação', kind: 'NATIONAL' },
    { m: 5, d: 1, name: 'Dia do Trabalhador', kind: 'NATIONAL' },
    { m: 9, d: 17, name: 'Dia do Herói Nacional', kind: 'NATIONAL' },
    { m: 11, d: 2, name: 'Dia dos Finados', kind: 'RELIGIOUS' },
    { m: 11, d: 11, name: 'Dia da Independência', kind: 'NATIONAL' },
    { m: 12, d: 25, name: 'Natal', kind: 'RELIGIOUS' },
  ];
  const easter = easterSunday(year);
  const carnaval = new Date(easter);
  carnaval.setUTCDate(carnaval.getUTCDate() - 48);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);

  return [
    ...fixed.map((f) => ({
      name: f.name,
      date: new Date(Date.UTC(year, f.m - 1, f.d)),
      recurring: true,
      kind: f.kind,
    })),
    { name: 'Segunda-feira de Carnaval', date: carnaval, recurring: false, kind: 'RELIGIOUS' as const },
    { name: 'Sexta-feira Santa', date: goodFriday, recurring: false, kind: 'RELIGIOUS' as const },
  ];
}
