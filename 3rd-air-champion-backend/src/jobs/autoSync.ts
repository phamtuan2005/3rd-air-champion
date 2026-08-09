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
      const rooms = await Room.find({
        host: host._id,
        active: true,
        airbnbUrl: { $exists: true, $ne: "" },
      }).lean();

      if (rooms.length === 0) {
        console.log(`${label}: no active rooms with AirBnB URL, skipping.`);
        continue;
      }

      console.log(`${label}: starting sync (${rooms.length} room(s))`);
      const { changes } = await runAirbnbSync({
        calendar: (host.calendar as any).toString(),
        guest: (host.airbnbGuestId as any).toString(),
        data: rooms.map((room: any) => ({
          room: room._id.toString(),
          link: room.airbnbUrl,
        })),
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