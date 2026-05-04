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
      await runAirbnbSync({
        calendar: (host.calendar as any).toString(),
        guest: (host.airbnbGuestId as any).toString(),
        data: rooms.map((room: any) => ({
          room: room._id.toString(),
          link: room.airbnbUrl,
        })),
      });
      console.log(`${label}: sync complete`);
    } catch (err: any) {
      console.error(`${label}: sync failed — ${err.message}`);
    }
  }
};