import Host from "../model/hostSchema";
import { runAirbnbSync } from "./airbnbSync";

export const autoSyncAllHosts = async () => {
  const hosts = await Host.find({
    "airbnbsync.0": { $exists: true },
    airbnbGuestId: { $exists: true, $ne: null },
  }).lean();

  if (hosts.length === 0) {
    console.log("[AutoSync] No hosts configured for AirBnB auto-sync.");
    return;
  }

  for (const host of hosts) {
    const label = `[AutoSync] Host ${host._id}`;
    try {
      console.log(`${label}: starting sync (${host.airbnbsync.length} room(s))`);
      await runAirbnbSync({
        calendar: (host.calendar as any).toString(),
        guest: (host.airbnbGuestId as any).toString(),
        data: host.airbnbsync.map((entry: any) => ({
          room: entry.room.toString(),
          link: entry.link,
        })),
      });
      console.log(`${label}: sync complete`);
    } catch (err: any) {
      console.error(`${label}: sync failed — ${err.message}`);
    }
  }
};