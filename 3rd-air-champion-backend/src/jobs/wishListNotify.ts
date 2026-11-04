import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import Host from "../model/hostSchema";
import Room from "../model/roomSchema";
import Day from "../model/daySchema";
import BookingRequest from "../model/bookingRequestSchema";
import WishList from "../model/wishListSchema";
import GuestMessage from "../model/guestMessageSchema";
import { nightStatus } from "../shared/generated/util/nightStatus";
import { phoneKey } from "../util/usPhone";

// Tells a wish-list guest, in their TiBook chat, when a night they wished for
// opens up.
//
// This used to be the host's job: TiMag's wish-list panel turned green and the
// host texted the guest from their own phone. Whenever the host was busy, a
// night freed in the afternoon sat unannounced until evening and was often
// gone to nobody. Now the house tells the guest itself, within the hour, and
// the host only hears about it in TiMag ("Told in TiBook chat").
//
// No hold is placed (host's call, 2026-10-23). Everyone who wished for the
// night is told, and the first request wins, exactly as when the host texted.
// The room stays bookable by anyone, so it is never kept empty waiting for a
// reply.

// The house is in Silicon Valley. "Tonight" is the house's tonight, not the
// server's: on a UTC box, 5pm Pacific is already tomorrow, and tonight's
// freed room would count as past and never be offered.
const HOUSE_TIME_ZONE = "America/Los_Angeles";

const DAY_MS = 86_400_000;

/** yyyy-MM-dd of a stored date, by its UTC day — how every date here is keyed. */
const keyOf = (d: Date) => new Date(d).toISOString().slice(0, 10);
const addNights = (key: string, n: number) => keyOf(new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS));
// The shared rule reads a night by its LOCAL date parts (it was written for a
// browser), so a key goes in as local midnight of that same date.
const localDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export interface WishState {
  /** Future nights on the wish list, yyyy-MM-dd. */
  nights: string[];
  status: string;
  announcedNights?: string[];
  freeLastRun: string[];
}

/**
 * What to tell one guest on this run. Kept apart from the database so the rules
 * can be tested on their own.
 *
 * `freeNow` holds the nights from this guest's list that are free for THEM:
 * nights they already have a room for, or have already asked for, are left out
 * by the caller.
 */
export const decideWishNews = (wish: WishState, freeNow: Set<string>) => {
  const free = wish.nights.filter((n) => freeNow.has(n)).sort();

  // First run on an entry the host had already texted by hand: what is free now
  // is what the host told them about. Adopt it rather than repeat it.
  if (wish.announcedNights === undefined && wish.status === "notified") {
    return { announce: [] as string[], announcedNights: free, freeLastRun: free };
  }

  const told = new Set(wish.announcedNights ?? []);
  const seenBefore = new Set(wish.freeLastRun);
  // Free on two runs in a row — see `freeLastRun` in the schema.
  const announce = free.filter((n) => !told.has(n) && seenBefore.has(n));
  return {
    announce,
    // A night taken again drops out here, so it is announced afresh if it
    // reopens.
    announcedNights: free.filter((n) => told.has(n) || announce.includes(n)),
    freeLastRun: free,
  };
};

/** The chat message for the nights being announced. English: it is the host's thread. */
export const wishNewsMessage = (guestName: string, nights: { night: string; rooms: string[] }[]) => {
  const first = guestName.trim().split(/\s+/)[0] || "there";
  const line = ({ night, rooms }: { night: string; rooms: string[] }) =>
    `${format(localDate(night), "EEE, MMM d")} — ${rooms.join(" or ")}`;
  const opener =
    nights.length === 1
      ? `Good news, ${first} — a night on your wish list just opened up: ${line(nights[0])}.`
      : `Good news, ${first} — nights on your wish list just opened up:\n` +
        nights.map((n) => `• ${line(n)}`).join("\n");
  // Says what will happen and what to tap, not "please submit a request": the
  // Book it card already has the nights in it.
  return (
    `${opener}\n\n` +
    `Rooms go to whoever asks first. Open TiBook and tap "Book it" — your request is ready to send.\n\n` +
    `(Sent automatically by TiBook.)`
  );
};

export const notifyWishListsForHost = async (hostId: any, calendarId: any, now = new Date()) => {
  const todayKey = formatInTimeZone(now, HOUSE_TIME_ZONE, "yyyy-MM-dd");
  const entries = await WishList.find({ host: hostId, status: { $ne: "booked" } });
  if (entries.length === 0) return { told: 0 };

  const wanted = entries.flatMap((e) => e.dates.map(keyOf)).filter((k) => k >= todayKey).sort();
  const lastKey = wanted[wanted.length - 1] ?? todayKey;

  const rooms = (await Room.find({ host: hostId, active: true }).select("_id name").lean()).map((r: any) => ({
    id: String(r._id),
    name: r.name,
  }));
  const days = await Day.find({
    calendar: calendarId,
    date: { $gte: new Date(`${todayKey}T00:00:00Z`), $lt: new Date(`${addNights(lastKey, 1)}T00:00:00Z`) },
  })
    .populate("bookings.guest", "phone")
    .lean();
  // The shape the shared rule reads: rooms as { id }.
  const monthMap = new Map<string, any>();
  for (const day of days as any[]) {
    monthMap.set(keyOf(day.date), {
      isBlocked: day.isBlocked,
      bookings: (day.bookings ?? []).map((b: any) => ({ room: b.room ? { id: String(b.room) } : null, guest: b.guest })),
      blockedRooms: (day.blockedRooms ?? []).map((r: any) => ({ id: String(r) })),
    });
  }

  // Requests by night. A "reserved" one is an unpaid hold: taken, as on the
  // calendar. A guest's OWN pending or reserved request means they have
  // already asked for that night — telling them it is free would be noise.
  const requests = await BookingRequest.find({ host: hostId, status: { $in: ["pending", "reserved"] } }).lean();
  const reservedMap = new Map<string, Set<string>>();
  const askedFor = new Map<string, Set<string>>(); // phone key -> nights
  for (const r of requests as any[]) {
    const who = phoneKey(r.guestPhone);
    for (let i = 0; i < r.duration; i++) {
      const night = addNights(keyOf(r.date), i);
      if (r.status === "reserved") {
        if (!reservedMap.has(night)) reservedMap.set(night, new Set());
        reservedMap.get(night)!.add(String(r.room));
      }
      if (!askedFor.has(who)) askedFor.set(who, new Set());
      askedFor.get(who)!.add(night);
    }
  }

  const today = localDate(todayKey);
  const freeRoomsOn = (night: string) =>
    nightStatus(localDate(night), rooms as any, monthMap, reservedMap, today).freeRooms.map((r: any) => r.name as string);

  let told = 0;
  for (const entry of entries) {
    try {
      const who = phoneKey(entry.guestPhone);
      const nights = entry.dates.map(keyOf).filter((k) => k >= todayKey);
      const theirs = (night: string) =>
        askedFor.get(who)?.has(night) ||
        (monthMap.get(night)?.bookings ?? []).some((b: any) => b.guest?.phone && phoneKey(b.guest.phone) === who);
      const freeNow = new Set(nights.filter((n) => !theirs(n) && freeRoomsOn(n).length > 0));

      const news = decideWishNews(
        {
          nights,
          status: entry.status,
          announcedNights: (entry as any).announcedNights,
          freeLastRun: (entry as any).freeLastRun ?? [],
        },
        freeNow,
      );

      if (news.announce.length > 0) {
        await GuestMessage.create({
          host: hostId,
          guestName: entry.guestName,
          guestPhone: entry.guestPhone,
          sender: "host",
          body: wishNewsMessage(
            entry.guestName,
            news.announce.map((night) => ({ night, rooms: freeRoomsOn(night) })),
          ),
          // The host did not write it, but it is the house speaking, and the
          // host's unread badge is for guests waiting on an answer.
          readByHost: true,
          readByGuest: false,
        });
        told++;
      }

      (entry as any).announcedNights = news.announcedNights;
      (entry as any).freeLastRun = news.freeLastRun;
      if (news.announce.length > 0 && entry.status === "waiting") entry.status = "notified";
      await entry.save();
    } catch (err: any) {
      // One guest's bad row must not stop the others hearing about their night.
      console.error(`[WishList] ${entry._id}: ${err.message}`);
    }
  }
  return { told };
};

export const notifyAllWishLists = async (now = new Date()) => {
  const hosts = await Host.find({ calendar: { $exists: true, $ne: null } }).select("_id calendar").lean();
  for (const host of hosts as any[]) {
    try {
      const { told } = await notifyWishListsForHost(host._id, host.calendar, now);
      if (told > 0) console.log(`[WishList] Host ${host._id}: told ${told} guest(s) a wish night opened up.`);
    } catch (err: any) {
      console.error(`[WishList] Host ${host._id}: ${err.message}`);
    }
  }
};
