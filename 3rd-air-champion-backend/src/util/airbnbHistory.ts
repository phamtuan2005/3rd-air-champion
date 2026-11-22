import mongoose from "mongoose";
import Host from "../model/hostSchema";
import Guest from "../model/guestSchema";
import Day from "../model/daySchema";
import { dayKey, shiftKey } from "./arrivingGuests";
import { reservationCode } from "./reservationCode";

// A new TiBook guest who has stayed here before, through AirBnB.
//
// Guests who first found the house on AirBnB come back and book on TiBook
// instead. TiMag knew them only by phone, and every AirBnB stay hangs off the
// one placeholder guest "AirBnB" — so Irina V, who had stayed through AirBnB,
// arrived on TiBook (2026-11-22) marked NEW, and the host had to remember her.
//
// What AirBnB leaves us about a guest is their first name (the booking's
// alias) and the last four digits of their phone (the feed's description).
// A TiBook request carries the full name and the full phone. Both have to
// agree: a first name alone is not a person — there is more than one David.
// A stay entered by hand has no phone on record; it matches on the name and
// says so, for the host to judge.

export interface AirbnbStayRow {
  start: string; // first night, yyyy-MM-dd
  end: string; // checkout morning, yyyy-MM-dd
  roomId: string;
  alias: string;
  description: string;
  payout: number;
}

export interface AirbnbPastStay {
  start: string;
  end: string;
  nights: number;
  roomId: string;
  alias: string;
  // What AirBnB paid out for the WHOLE stay (airbnbPrice); 0 when none is on
  // record. For the host, to see what a guest coming over from AirBnB has been
  // paying before quoting them a direct rate. Host-only: TiBook's public
  // welcome never sends it.
  payout: number;
  // "phone": the first name and the phone's last four both agree.
  // "name": a hand-entered stay with no phone on record; the name agrees.
  matchedBy: "phone" | "name";
}

// Lower case, accents off: "Irína" on one side and "Irina" on the other are
// the same guest.
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

const words = (s: string) => fold(s).split(/\s+/).filter(Boolean);

export const last4OfDescription = (description: string): string =>
  description.match(/Last 4 Digits\)?\s*:?\s*(\d{4})/i)?.[1] ?? "";

const last4OfPhone = (phone: string) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : "";
};

/** Does an AirBnB alias ("Irina", "Irina V") name this TiBook guest ("Irina Vaysertreyger")? */
export const aliasNamesGuest = (alias: string, guestName: string): boolean => {
  const a = words(alias);
  const g = words(guestName);
  if (!a.length || !g.length || a[0] !== g[0]) return false;
  // "Irina V": the initial must fit the surname when both are given.
  const initial = a[1];
  const surname = g[g.length - 1];
  if (initial && g.length > 1 && !surname.startsWith(initial[0])) return false;
  return true;
};

export const matchAirbnbStays = (
  rows: AirbnbStayRow[],
  guestName: string,
  guestPhone: string,
): AirbnbPastStay[] => {
  const phone4 = last4OfPhone(guestPhone);
  const out: AirbnbPastStay[] = [];
  for (const r of rows) {
    if (!aliasNamesGuest(r.alias, guestName)) continue;
    const stay4 = last4OfDescription(r.description);
    // A different number on record is a different person with the same name.
    if (stay4 && stay4 !== phone4) continue;
    const nights = Math.round((Date.parse(`${r.end}T00:00:00Z`) - Date.parse(`${r.start}T00:00:00Z`)) / 86400000);
    out.push({
      start: r.start,
      end: r.end,
      nights,
      roomId: r.roomId,
      alias: r.alias,
      payout: r.payout,
      matchedBy: stay4 ? "phone" : "name",
    });
  }
  // Newest first.
  return out.sort((x, y) => (x.start < y.start ? 1 : x.start > y.start ? -1 : 0));
};

export const lookupAirbnbHistory = async (
  hostId: string,
  guestName: string,
  guestPhone: string,
): Promise<AirbnbPastStay[]> => {
  const first = words(guestName)[0];
  if (!first || !mongoose.isValidObjectId(hostId)) return [];
  const [host, airbnb]: any[] = await Promise.all([
    Host.findById(hostId).select("calendar").lean(),
    Guest.findOne({ host: hostId, name: "AirBnB" }).select("_id").lean(),
  ]);
  if (!host?.calendar || !airbnb?._id) return [];
  // Narrowed in the database to aliases that start with the first name; the
  // accent-insensitive comparison is made above, on what comes back.
  const startsWith = new RegExp(`^\\s*${first.slice(0, 3).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  const days: any[] = await Day.find({
    calendar: host.calendar,
    bookings: { $elemMatch: { guest: airbnb._id, alias: startsWith } },
  })
    .select("date bookings.room bookings.guest bookings.alias bookings.description bookings.startDate bookings.endDate bookings.airbnbBlocked bookings.airbnbPrice")
    .lean();
  const rows: AirbnbStayRow[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    const key = dayKey(day.date);
    for (const b of day.bookings ?? []) {
      if (String(b.guest) !== String(airbnb._id) || b.airbnbBlocked || !b.startDate || !b.endDate) continue;
      // A stay is written onto every night it covers: read its START night only.
      if (dayKey(b.startDate) !== key) continue;
      // A cancelled-and-rebooked stay can sit on its nights twice; it is one stay.
      const id = `${reservationCode(b.description) || key}|${b.room}|${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        start: key,
        // endDate is the LAST NIGHT; the guest leaves the morning after.
        end: shiftKey(dayKey(b.endDate), 1),
        roomId: String(b.room ?? ""),
        alias: String(b.alias ?? ""),
        description: String(b.description ?? ""),
        payout: Number(b.airbnbPrice) || 0,
      });
    }
  }
  return matchAirbnbStays(rows, guestName, guestPhone);
};
