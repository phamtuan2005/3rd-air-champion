import Host from "../model/hostSchema";
import Room from "../model/roomSchema";
import { runAirbnbSync } from "./airbnbSync";

export const autoSyncAllHosts = async () => {
  const hosts = await Host.find({
    airbnbGuestId: { $exists: true, $ne: null },
  }).lean();

  if (hosts.length === 0) {
    console.log("[AutoSync] No hosts configured for AirBnB auto-sync.");
    return;
  }

  for (const host of hosts) {
    const label = `[AutoSync] Host ${host._id}`;
    try {
      // Use the host's stored iCal links, NOT room.airbnbUrl.
      //
      // room.airbnbUrl is the PUBLIC LISTING page — TiBook renders it as a
      // "View on AirBnB" link. Pointing the sync at it fetched HTML, which
      // parses to zero calendar events, so every run concluded that every
      // future reservation had been cancelled. On 2026-08-08 that wiped the
      // hand-entered payouts on 93 bookings: the sync unbooked them all, then
      // the app re-created them from the real feed with no payout attached.
      //
      // host.airbnbsync holds the actual iCal export URLs
      // (calendar/ical/<id>.ics?s=...), written by the Room Link modal, and is
      // exactly the { room, link } shape runAirbnbSync expects. It is also the
      // same source the in-app sync uses, so both paths now read one list.
      const activeIds = new Set(
        (await Room.find({ host: host._id, active: true }).select("_id").lean()).map((r: any) =>
          r._id.toString(),
        ),
      );

      // One entry per room: the stored list can hold duplicates (King appeared
      // three times), and each duplicate would refetch the same feed and
      // re-book the same nights.
      const linkByRoom = new Map<string, string>();
      for (const entry of (host as any).airbnbsync ?? []) {
        if (!entry?.room || !entry?.link) continue;
        const roomId = entry.room.toString();
        if (activeIds.has(roomId)) linkByRoom.set(roomId, entry.link);
      }

      const data = [...linkByRoom].map(([room, link]) => ({ room, link }));

      if (data.length === 0) {
        console.log(`${label}: no active rooms with an AirBnB iCal link, skipping.`);
        continue;
      }

      console.log(`${label}: starting sync (${data.length} room(s))`);
      const { changes } = await runAirbnbSync({
        calendar: (host.calendar as any).toString(),
        guest: (host.airbnbGuestId as any).toString(),
        data,
      });

      // Say what MOVED, not just that the run finished. On a 30-minute schedule
      // this is 48 lines a day; the ones that changed the calendar have to be
      // findable among them (`grep -v "no changes"` over pm2 logs).
      if (changes.added === 0 && changes.removed === 0) {
        console.log(`${label}: sync complete — no changes`);
      } else {
        console.log(
          `${label}: sync complete — ${changes.added} night(s) added, ${changes.removed} removed`,
        );
        // The nights themselves, so a surprise can be traced to a room and date
        // without reconstructing it from the calendar afterwards.
        if (changes.addedKeys.length) console.log(`${label}: added ${changes.addedKeys.join(", ")}`);
      }
    } catch (err: any) {
      console.error(`${label}: sync failed — ${err.message}`);
    }
  }
};