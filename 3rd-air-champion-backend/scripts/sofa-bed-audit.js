// Upcoming stays of three or more guests whose sofa bed is NOT ticked.
//
// READ-ONLY. Prints; writes nothing. The host decides each one in TiMag.
//
//   mongosh "mongodb://localhost:27017/airbnb-3rdparty" --quiet \
//     --file scripts/sofa-bed-audit.js
//
// Why this exists: until 2026-10-08 the sofa bed came on by itself only when a
// stay was booked or edited in the booking window. An AirBnB stay arrives from
// the feed as 1 guest and gets its real count from the pasted reservation, and
// that path never ticked it — Vincent's three in Queen reached Henry's TiWork
// with no sofa bed. The server now ticks it on any route, but only for counts
// set from then on; this lists the stays saved before.
//
// A stay with an untick the host MEANT (a couple and a child sharing the bed,
// say) will show here too. That is why it lists rather than fixes.

const HOST = "677203811c91b1e24326db49"; // Anh-Tuan
const FROM_GUESTS = 3; // SOFA_BED_FROM_GUESTS in graphql/resolvers/day.ts

const sid = (v) => (v ? (v._id ? String(v._id) : String(v)) : "");
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const pad = (s, n) => String(s === undefined || s === null ? "" : s).padEnd(n).slice(0, n);

const rooms = new Map();
db.rooms.find({ host: ObjectId(HOST) }).forEach((r) => rooms.set(sid(r._id), r.name));
const guests = new Map();
db.guests.find({ host: ObjectId(HOST) }).forEach((g) => guests.set(sid(g._id), g.name));
const calendarIds = db.calendars.find({ host: ObjectId(HOST) }).toArray().map((c) => c._id);

// Today as a UTC day key — dates are keyed by UTC day across the app.
const today = new Date().toISOString().slice(0, 10);

// A stay is written onto every night it covers: one row per stay, taken from
// the night it STARTS, so a four-night stay is listed once.
const rows = [];
// Filtered by its day key in code, as month-profit-audit does: a stored date
// is compared as yyyy-MM-dd, whatever type it was saved as.
db.days
  .find({ calendar: { $in: calendarIds } })
  .toArray()
  .filter((d) => iso(d.date) >= today)
  .sort((a, z) => iso(a.date).localeCompare(iso(z.date)))
  .forEach((d) => {
    const night = iso(d.date);
    (d.bookings || []).forEach((b) => {
      if (!b.room) return;
      if ((b.numberOfGuests || 1) < FROM_GUESTS || b.sofaBed) return;
      if (b.startDate && iso(b.startDate) !== night) return;
      const guest = guests.get(sid(b.guest)) || "";
      rows.push({
        start: night,
        end: b.endDate ? iso(b.endDate) : "",
        room: rooms.get(sid(b.room)) || "?",
        who: guest === "AirBnB" ? `${b.alias || "AirBnB"} (AirBnB)` : guest,
        guests: b.numberOfGuests,
        reserved: !!b.reserved,
      });
    });
  });

print(`Upcoming stays with ${FROM_GUESTS}+ guests and NO sofa bed, from ${today}: ${rows.length}`);
print("");
if (rows.length) {
  print(`${pad("First night", 12)} ${pad("Last night", 12)} ${pad("Room", 8)} ${pad("Guest", 28)} Guests`);
  rows.forEach((r) =>
    print(`${pad(r.start, 12)} ${pad(r.end, 12)} ${pad(r.room, 8)} ${pad(r.who, 28)} ${r.guests}${r.reserved ? "  (held)" : ""}`),
  );
  print("");
  print("Tick the sofa bed on each one that needs it: TiMag → the booking → Sofa bed.");
}
