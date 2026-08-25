// What a month actually earned and actually cost, booking by booking and
// cleaning by cleaning — the ground truth behind the Stats card's Total,
// Cleaning fee and Net.
//
// READ-ONLY. Prints; writes nothing.
//
//   mongosh "mongodb://localhost:27017/airbnb-3rdparty" --quiet \
//     --file scripts/month-profit-audit.js
//
// Change MONTH below to audit a different month.
//
// Why this exists: the Stats card prices FUTURE cleanings at a trailing average
// derived from recorded ones. If that average is wrong the whole month's Net is
// wrong, and there was no way to see the average without reading the database.
// The DIAGNOSTIC section at the end prints it next to the truth it is meant to
// approximate.

const HOST = "677203811c91b1e24326db49"; // Anh-Tuan
const MONTH = "2026-08"; // yyyy-MM

const sid = (v) => (v ? (v._id ? String(v._id) : String(v)) : "");
const iso = (v) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const money = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2);
const pad = (s, n) => String(s === undefined || s === null ? "" : s).padEnd(n).slice(0, n);
const padL = (s, n) => String(s === undefined || s === null ? "" : s).padStart(n);

// ── Lookups ─────────────────────────────────────────────────────────────────
const rooms = new Map();
db.rooms.find({ host: ObjectId(HOST) }).forEach((r) => rooms.set(sid(r._id), r.name));
const guests = new Map();
db.guests.find({ host: ObjectId(HOST) }).forEach((g) => guests.set(sid(g._id), g.name));
const calendarIds = db.calendars
  .find({ host: ObjectId(HOST) })
  .toArray()
  .map((c) => c._id);

// ── 1. Revenue, stay by stay ────────────────────────────────────────────────
//
// A stay is written onto EVERY night it covers, so nights are grouped back into
// stays by room + guest + startDate. Whole-stay fees land ONCE, on the start
// night — the same rule util/profit.ts bookingNightAmount uses, so these
// figures are the ones the app shows rather than a second opinion.
const days = db.days
  .find({ calendar: { $in: calendarIds } })
  .toArray()
  .filter((d) => iso(d.date).slice(0, 7) === MONTH);

const stays = new Map();
let monthGross = 0;
let monthDirect = 0;
let monthAirbnb = 0;
let monthFees = 0;
let roomNights = 0;

for (const day of days) {
  const dateKey = iso(day.date);
  for (const b of day.bookings || []) {
    if (!b.room) continue;
    const guestName = guests.get(sid(b.guest)) || "(unknown)";
    const isAirbnb = guestName === "AirBnB";
    const startKey = iso(b.startDate);
    // Fees are per STAY though stored on every night — only the start night
    // carries them into the total.
    const fee =
      startKey === dateKey
        ? (b.fees || []).reduce((s, f) => s + (Number(f.amount) || 0), 0)
        : 0;
    const nightly = isAirbnb
      ? b.duration
        ? (b.airbnbPrice || 0) / b.duration
        : 0
      : b.price || 0;
    const amount = nightly + fee;

    monthGross += amount;
    monthFees += fee;
    roomNights += 1;
    if (isAirbnb) monthAirbnb += amount;
    else monthDirect += amount;

    const key = `${sid(b.room)}|${sid(b.guest)}|${startKey}`;
    const s = stays.get(key) || {
      guest: b.alias || guestName,
      kind: isAirbnb ? "AirBnB" : "Direct",
      room: rooms.get(sid(b.room)) || "(room)",
      start: startKey,
      duration: b.duration || 1,
      nightsInMonth: 0,
      nightly,
      fees: 0,
      revenue: 0,
      reserved: !!b.reserved,
    };
    s.nightsInMonth += 1;
    s.fees += fee;
    s.revenue += amount;
    stays.set(key, s);
  }
}

const stayList = [...stays.values()].sort((a, b) =>
  a.start === b.start ? a.room.localeCompare(b.room) : a.start < b.start ? -1 : 1,
);

print(`\n═══ REVENUE — ${MONTH} — ${stayList.length} stays, ${roomNights} room-nights ═══\n`);
print(
  pad("START", 11) + pad("ROOM", 9) + pad("GUEST", 20) + pad("KIND", 8) +
    padL("NTS", 4) + padL("NIGHTLY", 10) + padL("FEES", 9) + padL("REVENUE", 11) + "  FLAG",
);
for (const s of stayList) {
  print(
    pad(s.start, 11) + pad(s.room, 9) + pad(s.guest, 20) + pad(s.kind, 8) +
      padL(s.nightsInMonth, 4) + padL(money(s.nightly), 10) +
      padL(s.fees ? money(s.fees) : "-", 9) + padL(money(s.revenue), 11) +
      (s.reserved ? "  HELD/unpaid" : "") +
      // A deliberate $0 is family, not a fault — named so nobody "fixes" it.
      (s.nightly === 0 && !s.fees ? "  $0 (family?)" : ""),
  );
}
print(
  `\n  Direct ${money(monthDirect)}   AirBnB ${money(monthAirbnb)}   ` +
    `Fees ${money(monthFees)}   GROSS ${money(monthGross)}`,
);

// ── 2. Cleaning, event by event ─────────────────────────────────────────────
//
// A cleaning EVENT is a cleaner-day (a visit), not an assignment row. The app
// records a visit's hours onto the FIRST room's row and 0 onto the rest, so a
// row on its own is not a cleaning and its hours are not that room's hours.
const cleaners = new Map();
db.cleaners.find({ host: ObjectId(HOST) }).forEach((c) => cleaners.set(sid(c._id), c));

// Same rate-on-a-date rule the app uses, so a past month is priced at the rate
// that was actually in force, not today's.
const rateOn = (c, dateStr) => {
  if (!c) return 0;
  let rate = c.payRate || 0;
  const hist = (c.rateHistory || []).slice().sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : 1,
  );
  for (const h of hist) {
    if (h.effectiveFrom <= dateStr) rate = h.rate;
    else break;
  }
  return rate;
};

const allAssignments = db.cleaningassignments.find({ host: ObjectId(HOST) }).toArray();
const visits = new Map();
for (const a of allAssignments) {
  const key = `${sid(a.cleaner)}|${a.date}`;
  const v = visits.get(key) || {
    date: a.date,
    cleanerId: sid(a.cleaner),
    rooms: [],
    hours: 0,
    recordedRows: 0,
    nullRows: 0,
    zeroRows: 0,
  };
  v.rooms.push(rooms.get(sid(a.room)) || "?");
  if (a.hours === null || a.hours === undefined) v.nullRows += 1;
  else {
    v.recordedRows += 1;
    v.hours += a.hours;
    if (a.hours === 0) v.zeroRows += 1;
  }
  visits.set(key, v);
}

const worked = [...visits.values()].filter((v) => v.hours > 0);
const monthVisits = worked
  .filter((v) => v.date.slice(0, 7) === MONTH)
  .sort((a, b) => (a.date < b.date ? -1 : 1));

print(`\n═══ CLEANING — ${MONTH} — ${monthVisits.length} visits ═══\n`);
print(
  pad("DATE", 12) + pad("CLEANER", 14) + padL("RMS", 4) + padL("HOURS", 8) +
    padL("H/ROOM", 8) + padL("RATE", 8) + padL("COST", 10) + padL("$/ROOM", 9) + "  ROOMS",
);
let monthCleaningCost = 0;
let monthCleanRooms = 0;
for (const v of monthVisits) {
  const c = cleaners.get(v.cleanerId);
  const rate = rateOn(c, v.date);
  const cost = v.hours * rate;
  monthCleaningCost += cost;
  monthCleanRooms += v.rooms.length;
  print(
    pad(v.date, 12) + pad(c ? c.name : "(gone)", 14) + padL(v.rooms.length, 4) +
      padL(v.hours.toFixed(2), 8) + padL((v.hours / v.rooms.length).toFixed(2), 8) +
      padL(money(rate), 8) + padL(money(cost), 10) +
      padL(money(cost / v.rooms.length), 9) + "  " + v.rooms.join(", "),
  );
}
print(`\n  ${monthCleanRooms} rooms cleaned   COST ${money(monthCleaningCost)}`);

// ── 3. Misc + the month's bottom line ───────────────────────────────────────
// Same rule as util/miscOperations isExpenseInMonth: a recurring bill runs from
// its first month until endMonth (inclusive), "" meaning ongoing.
let monthMisc = 0;
db.miscs.find({ host: ObjectId(HOST) }).forEach((e) => {
  const startMonth = String(e.date || "").slice(0, 7);
  if (!startMonth) return;
  const inMonth = !e.recurring
    ? startMonth === MONTH
    : MONTH >= startMonth && (!e.endMonth || MONTH <= e.endMonth);
  if (inMonth) monthMisc += e.amount || 0;
});

print(`\n═══ ${MONTH} BOTTOM LINE ═══\n`);
print(`  Gross revenue    ${padL(money(monthGross), 12)}`);
print(`  Cleaning         ${padL("-" + money(monthCleaningCost), 12)}`);
print(`  Misc             ${padL("-" + money(monthMisc), 12)}`);
print(`  ${"".padEnd(30, "-")}`);
print(`  NET              ${padL(money(monthGross - monthCleaningCost - monthMisc), 12)}`);

// ── 4. DIAGNOSTIC — the number the Stats forecast rests on ──────────────────
//
// Stats prices every future cleaning at (mean hours per ROW) x (mean rate). It
// filters to rows where hours != null, so whether that mean is per-ROOM or
// per-VISIT depends entirely on what the sibling rows of a multi-room visit
// hold. 0 keeps them in the denominator (per room, right); null drops them
// (per visit, ~2x too high at two rooms a visit).
const allRooms = worked.reduce((s, v) => s + v.rooms.length, 0);
const allHours = worked.reduce((s, v) => s + v.hours, 0);
const nullsInWorked = worked.reduce((s, v) => s + v.nullRows, 0);
const zerosInWorked = worked.reduce((s, v) => s + v.zeroRows, 0);

const statsRows = allAssignments.filter((a) => a.hours !== null && a.hours !== undefined && a.cleaner);
const statsHours = statsRows.reduce((s, a) => s + a.hours, 0) / (statsRows.length || 1);
const statsRate =
  statsRows.reduce((s, a) => s + rateOn(cleaners.get(sid(a.cleaner)), a.date), 0) /
  (statsRows.length || 1);

print(`\n═══ DIAGNOSTIC — what the forecast believes vs what is true ═══\n`);
print(`  TRUE hours per room      ${(allHours / allRooms).toFixed(3)} h   (${allHours.toFixed(1)} h over ${allRooms} rooms, all time)`);
print(`  TRUE rooms per visit     ${(allRooms / worked.length).toFixed(2)}`);
print(`  TRUE cost per room       ${money(
  worked.reduce((s, v) => s + v.hours * rateOn(cleaners.get(v.cleanerId), v.date), 0) / allRooms,
)}`);
print("");
print(`  Stats mean hours/row     ${statsHours.toFixed(3)} h   (over ${statsRows.length} rows with a value)`);
print(`  Stats mean rate          ${money(statsRate)}`);
print(`  Stats price per clean    ${money(statsHours * statsRate)}`);
print("");
print(`  Sibling rows holding 0    ${zerosInWorked}`);
print(`  Sibling rows holding null ${nullsInWorked}`);
if (nullsInWorked > 0)
  print(
    `\n  >> ${nullsInWorked} room row(s) inside recorded visits are null, not 0.\n` +
      `     Those rooms are missing from the Stats denominator, which is why the\n` +
      `     forecast prices a clean above what one actually costs.`,
  );
else
  print(`\n  >> No null sibling rows. The Stats average is genuinely per-room;\n     any gap is in the recorded hours themselves, not the arithmetic.`);
