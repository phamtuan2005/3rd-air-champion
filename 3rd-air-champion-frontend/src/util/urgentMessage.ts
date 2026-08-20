// Reading a guest's text message about a last-minute change.
//
// This exists because of a real night: a guest wrote that he would check in at
// "1-2am", it was read in a hurry as "1-2pm", the room was opened as a no-show —
// and he arrived. Everything here is built around that failure:
//
//   • The message is read from the guest's OWN WORDS, pasted in verbatim. A form
//     the host retypes the time into just moves the misreading one step earlier.
//   • A time is re-stated in words that cannot be skimmed wrong. "1-2am" and
//     "1-2pm" differ by two characters; "after midnight" and "afternoon" cannot
//     be confused at a glance.
//   • Where the message does not actually say, this says so. The host has said
//     he will not decide these without asking TiMag, so an answer invented to
//     look confident is worse than no answer.
//
// Pure and synchronous: no network, no model, nothing that can be unavailable at
// 1am. Anything it cannot read, it declines to read.

export type ArrivalIntent =
  | "arriving-late" // still coming, just late — hold the room
  | "not-coming" // cancelling, or saying they will not make it — the room is free
  | "unclear"; // says something, but not which of the two

export type Meridiem = "am" | "pm" | "unstated";

export interface ArrivalTime {
  // Minutes past midnight, 0–1439. Start of the range where a range was given.
  fromMinutes: number;
  // End of a range ("1-2am"), else null.
  toMinutes: number | null;
  meridiem: Meridiem;
  // True when the text gave a bare number with no am/pm — the exact shape that
  // caused the incident.
  ambiguous: boolean;
}

export interface MessageReading {
  intent: ArrivalIntent;
  time: ArrivalTime | null;
  // Weekday named in the message (0=Sunday), or null. NOT resolved to a date
  // here: which Tuesday depends on the booking, which this module cannot see.
  weekday: number | null;
  // Plain-language re-statement of the time, or null where none could be read.
  // "1:00 AM (after midnight)" rather than "1am".
  timeInWords: string | null;
  // Everything the reading rests on, and everything it could not settle. Shown
  // to the host verbatim: he is confirming a reading, not trusting one.
  notes: string[];
  // True when the message names a time in the small hours — the case where the
  // arrival belongs to the night BEFORE the calendar day the guest names.
  afterMidnight: boolean;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

// Said plainly enough that it cannot be skimmed wrong.
const inWords = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const clock = h12 + ":" + String(m).padStart(2, "0") + " " + (h24 < 12 ? "AM" : "PM");
  if (h24 < 5) return clock + " (after midnight)";
  if (h24 < 12) return clock + " (morning)";
  if (h24 < 17) return clock + " (afternoon)";
  if (h24 < 21) return clock + " (evening)";
  return clock + " (late evening)";
};

// The verbs a guest uses for turning up, in every form they write them in:
// come/coming, make it/making it, checkin/checking in, arrive/arriving. A
// negation has to cover the same spread as the plain statement, or "I won't be
// coming" reads as no statement at all and the host is told to ask when the
// guest could not have been clearer.
const ARRIVE_VERB =
  "(?:com(?:e|ing)|mak(?:e|ing)\\s+it|check(?:ing)?\\s?in|arriv(?:e|ing)|be\\s+there|stay(?:ing)?)";

const NOT_COMING = [
  /\bcancel(l?ing|led|lation)?\b/,
  new RegExp(
    "\\b(?:can'?t|cannot|won'?t|wont|will not|shan'?t)\\s+(?:be\\s+)?" + ARRIVE_VERB + "\\b",
  ),
  new RegExp(
    "\\b(?:not|never)\\s+(?:going to\\s+|gonna\\s+)?(?:be able to\\s+|be\\s+)?" +
      ARRIVE_VERB +
      "\\b",
  ),
  /\bno longer (coming|need|needed|require)\b/,
  /\bchanged? my plans?\b/,
];

// "I can't make it before 11pm" is a LATE ARRIVAL wearing a cancellation's
// words. Without this it read as "can't make it" and recommended opening the
// room on a guest who was on his way — the very mistake this tool exists to
// stop. A negative followed by "before"/"until" is a bound on when they arrive,
// not a statement that they are not coming.
const NEGATIVE_BUT_ARRIVING =
  /\b(can'?t|cannot|won'?t|will not|unable to|not going to|not gonna)\b[^.!?]{0,40}\b(before|until|til{1,2}|earlier than|any earlier)\b/;

const STILL_COMING = [
  /\bcheck ?in\b/,
  /\barriv(e|es|ing|al)\b/,
  /\bgett?ing (in|there)\b/,
  /\b(be|running) late\b/,
  /\blate\b/,
  /\bon my way\b/,
  /\bsee you\b/,
];

const readMeridiem = (s?: string): Meridiem =>
  !s ? "unstated" : s.replace(/\./g, "").startsWith("a") ? "am" : "pm";

const toMinutes = (h: number, m: number, mer: Meridiem): number => {
  let hour = h;
  if (mer === "am") hour = h === 12 ? 0 : h;
  else if (mer === "pm") hour = h === 12 ? 12 : h + 12;
  return hour * 60 + m;
};

/**
 * Read a guest's message. `text` is pasted verbatim; nothing else is assumed.
 */
export const readGuestMessage = (text: string): MessageReading => {
  const raw = (text ?? "").trim();
  // En/em dashes are what a phone keyboard produces for a typed hyphen.
  const t = raw.toLowerCase().replace(/[–—]/g, "-");
  const notes: string[] = [];

  if (!raw) {
    return {
      intent: "unclear",
      time: null,
      weekday: null,
      timeInWords: null,
      afterMidnight: false,
      notes: ["Nothing pasted yet."],
    };
  }

  // ── Weekday ────────────────────────────────────────────────────────────────
  let weekday: number | null = null;
  for (const word of Object.keys(WEEKDAYS)) {
    if (new RegExp("\\b" + word + "\\b").test(t)) {
      weekday = WEEKDAYS[word];
      break;
    }
  }
  if (/\btonight\b/.test(t)) notes.push('Says "tonight".');
  if (/\btomorrow\b/.test(t)) {
    notes.push('Says "tomorrow" — count from the day the message was SENT, not from today.');
  }

  // ── Time ───────────────────────────────────────────────────────────────────
  let time: ArrivalTime | null = null;

  // The safest phrasing a guest can use: no digits to misread.
  const saysMidnight = /\bmidnight\b/.test(t);

  // 1-2am · 1 - 2 am · 1:30-2:30am · 1-2 (no meridiem)
  const range = t.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(?:-|to|till|til|until)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/,
  );
  // 11pm · 1:30 am
  const single = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  // 13:00 — a colon makes it a clock reading
  const clock = t.match(/\b(\d{1,2}):(\d{2})\b/);

  if (range) {
    const mer = readMeridiem(range[5]);
    time = {
      fromMinutes: toMinutes(Number(range[1]), Number(range[2] ?? 0), mer),
      toMinutes: toMinutes(Number(range[3]), Number(range[4] ?? 0), mer),
      meridiem: mer,
      ambiguous: mer === "unstated",
    };
  } else if (single) {
    const mer = readMeridiem(single[3]);
    time = {
      fromMinutes: toMinutes(Number(single[1]), Number(single[2] ?? 0), mer),
      toMinutes: null,
      meridiem: mer,
      ambiguous: false,
    };
  } else if (clock) {
    const h = Number(clock[1]);
    time = {
      fromMinutes: h * 60 + Number(clock[2]),
      toMinutes: null,
      meridiem: h < 12 ? "am" : "pm",
      ambiguous: false,
    };
  } else if (saysMidnight) {
    time = { fromMinutes: 0, toMinutes: null, meridiem: "am", ambiguous: false };
    notes.push('Says "midnight" in words — no digits to misread.');
  }

  // A bare number with no am/pm is the exact shape of the message that caused
  // the trouble. It is not guessed at.
  if (time?.ambiguous) {
    notes.push(
      "The message does not say AM or PM. The two readings are twelve hours apart — ask the guest before deciding.",
    );
  }

  const afterMidnight = !!time && !time.ambiguous && time.fromMinutes < 5 * 60;
  if (afterMidnight) {
    notes.push(
      "This is in the small hours, so the arrival belongs to the night BEFORE that calendar day.",
    );
  }

  const timeInWords =
    !time || time.ambiguous
      ? null
      : time.toMinutes != null
        ? inWords(time.fromMinutes) + " to " + inWords(time.toMinutes)
        : inWords(time.fromMinutes);

  // ── Intent ─────────────────────────────────────────────────────────────────
  // The negated phrase is REMOVED before looking for signs they are coming.
  // Otherwise "I won't be arriving" trips both lists — the arrival verb being
  // matched is the very one the guest negated — and a perfectly clear message
  // reads as self-contradictory.
  let residue = t;
  for (const re of NOT_COMING) residue = residue.replace(re, " ");

  const boundedLate = NEGATIVE_BUT_ARRIVING.test(t);
  if (boundedLate) {
    notes.push(
      'Says what they CANNOT do before a time — that is a late arrival, not a cancellation.',
    );
  }
  const saysNotComing = !boundedLate && NOT_COMING.some((re) => re.test(t));
  const saysComing = boundedLate || STILL_COMING.some((re) => re.test(residue));

  let intent: ArrivalIntent;
  if (saysNotComing && !saysComing) {
    intent = "not-coming";
    notes.push("Reads as the guest NOT coming.");
  } else if (saysNotComing && saysComing) {
    // "I can't make it before 11pm" is a late arrival, not a cancellation, and
    // the two phrasings look alike. Refuse rather than pick.
    intent = "unclear";
    notes.push(
      "The message has both a cancelling phrase and an arriving one — read it yourself before acting.",
    );
  } else if (saysComing || time) {
    intent = "arriving-late";
    notes.push("Reads as the guest still coming, only later.");
  } else {
    intent = "unclear";
    notes.push("Nothing here says whether they are coming or not.");
  }

  if (!time && intent === "arriving-late") {
    notes.push("No arrival time given — it says late, but not how late.");
  }

  return { intent, time, weekday, timeInWords, afterMidnight, notes };
};
