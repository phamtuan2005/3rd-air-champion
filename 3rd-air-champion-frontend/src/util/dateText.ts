// Reading the dates a guest types.
//
// TiBook has always had a "Write your dates" box, and it has never been read —
// whatever was typed rode along as a note on ONE request built from the form's
// default date, leaving the host to re-enter the real thing by hand. A guest
// writing "Aug 23, 24, 25, 27, and Sept 2,3,4" is being perfectly clear; the
// app was simply not listening.
//
// Deliberately deterministic: no model, no network, no cost, and no way for a
// public text box to spend anybody's money. Guests type dates in a handful of
// shapes, and those shapes are enumerable. Anything not recognised is handed
// back untouched rather than guessed at — it still reaches the host as a note.

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export interface ParsedDates {
  // Unique yyyy-MM-dd, ascending. Bookable: today or later.
  dates: string[];
  // Nights that have already been and gone, kept apart rather than dropped.
  //
  // A guest writing "Aug 20-30" on the 24th means one stay; the days at the
  // front of it are simply behind us. Silently discarding them would leave
  // them wondering what happened to the dates they typed, and silently
  // booking them is not possible. So they come back separately and TiBook
  // says which ones passed.
  past: string[];
  // The words that carried no date. Kept verbatim: it is the guest's message,
  // and "we'll have a dog with us" matters even though it is not a date.
  leftover: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/**
 * Read dates out of free text.
 *
 * `today` anchors the year: a month/day already past is taken as next year,
 * because somebody typing "Jan 3" in December means the January that is coming,
 * not the one that has gone.
 *
 * Understood shapes, in the order guests actually write them:
 *   "Aug 23"            "23 Aug"          "Aug 23, 24, 25, 27"
 *   "Sept 2,3,4"        "Aug 23-25"       "May 1, 3–5, 20–21"
 *   "8/23"              "8/23/2026"       "tonight"  "tomorrow"
 * A bare number carries the month most recently named, which is what makes
 * "Aug 23, 24, 25" mean three days in August rather than three loose numbers.
 *
 * Comes back in two piles: `dates`, which are today or later and can be asked
 * for, and `past`, which cannot. Nothing in `past` is dropped — the guest
 * typed it, and being told "the 20th has already gone" is the only useful
 * answer. A whole run is dated as one unit, so a stay that straddles today
 * stays one stay.
 */
export const parseDateText = (text: string, today: Date = new Date()): ParsedDates => {
  const raw = (text ?? "").trim();
  if (!raw) return { dates: [], past: [], leftover: "" };

  const found = new Set<string>();
  // Which stretches of the input were consumed, so the rest can be handed back.
  const used: [number, number][] = [];

  const y0 = today.getFullYear();
  const m0 = today.getMonth();
  const d0 = today.getDate();

  // The year for a month/day with no year on it: this one, unless it has been
  // and gone, in which case the next.
  const yearFor = (m: number, d: number): number =>
    m < m0 || (m === m0 && d < d0) ? y0 + 1 : y0;

  const addDay = (m: number, d: number, year?: number) => {
    if (m < 0 || m > 11) return;
    const y = year ?? yearFor(m, d);
    if (d < 1 || d > daysInMonth(y, m)) return;
    found.add(keyOf(y, m, d));
  };

  const lower = raw.toLowerCase().replace(/[–—]/g, "-");

  // ── tonight / today / tomorrow ─────────────────────────────────────────────
  for (const [word, offset] of [["tonight", 0], ["today", 0], ["tomorrow", 1]] as const) {
    const at = lower.indexOf(word);
    if (at === -1) continue;
    const when = new Date(today);
    when.setDate(when.getDate() + offset);
    found.add(keyOf(when.getFullYear(), when.getMonth(), when.getDate()));
    used.push([at, at + word.length]);
  }

  // ── 8/23 and 8/23/2026 ─────────────────────────────────────────────────────
  const slash = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  for (let hit = slash.exec(lower); hit; hit = slash.exec(lower)) {
    const m = Number(hit[1]) - 1;
    const d = Number(hit[2]);
    const yr = hit[3] ? Number(hit[3].length === 2 ? "20" + hit[3] : hit[3]) : undefined;
    addDay(m, d, yr);
    used.push([hit.index, hit.index + hit[0].length]);
  }

  // ── A month name, then every number that follows it ────────────────────────
  //
  // The run of numbers after a month is the whole point: "Aug 23, 24, 25, 27"
  // is one month and four days. The run ends at the next month name or at any
  // word that is not a number, a separator or a range dash.
  const monthWord = new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\b\\.?`, "g");
  const monthHits: { index: number; end: number; month: number }[] = [];
  for (let hit = monthWord.exec(lower); hit; hit = monthWord.exec(lower)) {
    monthHits.push({ index: hit.index, end: hit.index + hit[0].length, month: MONTHS[hit[1]] });
  }

  monthHits.forEach((hit, i) => {
    used.push([hit.index, hit.end]);

    // "23 Aug" — a number immediately before the month name belongs to it.
    //
    // Whitespace only between the two. A COMMA means the number closed the
    // previous month's list: in "Aug 23, Sept 2", the 23 is August's and must
    // not be handed to September as well.
    const before = lower.slice(Math.max(0, hit.index - 12), hit.index);
    const trailing = before.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?$/);
    if (trailing) {
      addDay(hit.month, Number(trailing[1]));
      const at = hit.index - (trailing[0].length);
      used.push([Math.max(0, at), hit.index]);
    }

    // Everything from after the month name up to the next month name.
    const stop = monthHits[i + 1]?.index ?? lower.length;
    const tail = lower.slice(hit.end, stop);
    // Numbers, ranges and separators only — the first thing that is none of
    // those ends the run, so "Aug 23 and we have a dog 4 nights" does not
    // silently swallow the 4.
    const run = tail.match(/^[\s,.;&]*(?:and\s+)?(?:\d{1,2}(?:st|nd|rd|th)?(?:\s*-\s*\d{1,2}(?:st|nd|rd|th)?)?[\s,.;&]*(?:and\s+)?)+/);
    if (!run) return;
    used.push([hit.end, hit.end + run[0].length]);

    const numbers = run[0].match(/\d{1,2}(?:\s*-\s*\d{1,2})?/g) ?? [];
    const days: number[] = [];
    for (const piece of numbers) {
      const range = piece.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        // A backwards range is a typo, not a wrap-around. Read it either way
        // round rather than producing nothing.
        for (let d = Math.min(a, b); d <= Math.max(a, b); d++) days.push(d);
      } else {
        days.push(Number(piece));
      }
    }
    if (days.length === 0) return;

    // ONE year for the whole run, decided by its LAST day.
    //
    // The year used to be worked out per day, which tore a single stay in two
    // whenever it straddled today: "Aug 20-30" typed on the 24th came back as
    // the 24th to the 30th of THIS year plus the 20th to the 23rd of NEXT —
    // eleven nights across two years, from a guest who asked for one span.
    // Anchoring on the last day keeps the intent the tests describe: a run
    // wholly behind us ("Aug 5" in August) is the one coming round again,
    // while a run that reaches into the future stays in this year, front and
    // all. The days at the front that have passed are separated out below.
    const runYear = yearFor(hit.month, Math.max(...days));
    for (const d of days) addDay(hit.month, d, runYear);
  });

  // ── What was left ──────────────────────────────────────────────────────────
  used.sort((a, b) => a[0] - b[0]);
  let leftover = "";
  let cursor = 0;
  for (const [from, to] of used) {
    if (from > cursor) leftover += raw.slice(cursor, from);
    cursor = Math.max(cursor, to);
  }
  leftover += raw.slice(cursor);

  // Today itself is not past — a guest asking for tonight is asking for a
  // night that can still be had. Compared as yyyy-MM-dd strings, which sort
  // correctly and never touch a timezone.
  const todayKey = keyOf(y0, m0, d0);
  const all = [...found].sort();

  return {
    dates: all.filter((d) => d >= todayKey),
    past: all.filter((d) => d < todayKey),
    // Strip the punctuation left behind when the dates are lifted out, so
    // "Aug 23, 24 — and we have a dog" does not come back as ", — and…".
    // The dash class covers the en and em dashes a phone keyboard produces —
    // the leftover is sliced from the ORIGINAL text, which never had them
    // normalised away.
    leftover: leftover
      .replace(/\s+/g, " ")
      .replace(/^[\s,.;&\-–—]+|[\s,.;&\-–—]+$/g, "")
      .trim(),
  };
};
