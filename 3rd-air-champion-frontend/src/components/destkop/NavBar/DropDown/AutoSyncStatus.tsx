import { useEffect, useState } from "react";
import { fetchHost, getHost } from "../../../../util/hostOperations";
import { fetchRooms } from "../../../../util/roomOperations";

interface AutoSyncRun {
  at?: string;
  added?: number;
  removed?: number;
  addedKeys?: string[];
  error?: string;
}

// How long the server may go quiet before that itself is the news.
//
// The job runs every 30 minutes, so one missed tick is normal jitter and two is
// not. Past that the honest reading is "this has stopped", and saying so is the
// whole point of the component.
const STALE_MINUTES = 70;

const minutesAgo = (iso: string) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / 60000));
};

const humanGap = (mins: number) => {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

// addedKeys are raw `date_roomId` pairs, one per NIGHT. A single three-night
// booking arrives as three keys, which would read as three bookings. Collapse
// them to "King · Sep 1–3" so the line describes the stay a person recognises.
const describeAdds = (keys: string[], roomNames: Map<string, string>) => {
  const byRoom = new Map<string, string[]>();
  for (const key of keys) {
    const [date, roomId] = key.split("_");
    if (!date) continue;
    const name = roomNames.get(roomId) ?? "Room";
    byRoom.set(name, [...(byRoom.get(name) ?? []), date]);
  }
  return [...byRoom.entries()].map(([name, dates]) => {
    const sorted = [...dates].sort();
    const fmt = (d: string) => {
      // Split the string rather than new Date(d) — a bare yyyy-MM-dd parses as
      // UTC midnight and prints as the evening before west of Greenwich.
      const [, m, day] = d.split("-");
      const month = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] ?? m;
      return `${month} ${Number(day)}`;
    };
    const span = sorted.length > 1 ? `${fmt(sorted[0])}–${fmt(sorted[sorted.length - 1])}` : fmt(sorted[0]);
    return `${name} · ${span}`;
  });
};

// What the scheduled AirBnB sync did last, said out loud.
//
// The job left no trace but a log line on the EC2 box, so "is auto-sync
// working?" could only be answered over SSH — and the app syncs on every open,
// so a healthy tick almost always finds nothing to do and looks identical to a
// job that died weeks ago. That ambiguity is what made the feature feel
// unreliable, not the syncing itself. This states the time and the outcome so
// the question stops needing an investigation.
const AutoSyncStatus = () => {
  const [run, setRun] = useState<AutoSyncRun | null>(null);
  const [roomNames, setRoomNames] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState(false);

  // Fetched on mount, and the dropdown mounts on open — so the elapsed time is
  // read fresh every time rather than aging inside a value cached at login.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let hostId: string;
    try {
      hostId = getHost() as string;
    } catch {
      setFailed(true);
      return;
    }

    fetchHost(hostId, token)
      .then((h: any) => setRun(h?.lastAutoSync ?? {}))
      .catch(() => setFailed(true));

    fetchRooms(hostId, token)
      .then((rooms: any[]) =>
        setRoomNames(new Map((rooms ?? []).map((r) => [r.id, r.name]))),
      )
      .catch(() => undefined);
  }, []);

  if (failed) return null;

  const at = run?.at;
  const mins = at ? minutesAgo(at) : null;
  const stale = mins === null || mins > STALE_MINUTES;
  const errored = !!run?.error;

  // Four states, and the fourth is the one that matters most for trust:
  // "nothing has reported yet" is NOT the same as "it has gone quiet".
  //
  // Treating a missing timestamp as stale meant the very first look after a
  // deploy showed an amber warning about a job that had not yet had a chance to
  // run — crying wolf at exactly the moment the host is deciding whether to
  // believe this readout at all. Grey says "no news", which is the truth.
  const tone = errored
    ? { dot: "bg-red-500", text: "text-red-700", label: "Auto-sync failing" }
    : !at
      ? { dot: "bg-gray-300", text: "text-gray-600", label: "Auto-sync not reported yet" }
      : stale
        ? { dot: "bg-amber-500", text: "text-amber-700", label: "Auto-sync silent" }
        : { dot: "bg-green-500", text: "text-green-700", label: "Auto-sync running" };

  const adds = run?.addedKeys?.length ? describeAdds(run.addedKeys, roomNames) : [];

  return (
    <div className="rounded-xl border border-gray-200 px-3 py-2 text-left">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
        <span className={`text-xs font-bold ${tone.text}`}>{tone.label}</span>
        {at && mins !== null && (
          <span className="ml-auto text-[11px] text-gray-500">{humanGap(mins)}</span>
        )}
      </div>

      {!run || !at ? (
        <p className="mt-1 text-[11px] leading-tight text-gray-500">
          Waiting for the first run. Ticks land on the hour and half hour.
        </p>
      ) : errored ? (
        <p className="mt-1 text-[11px] leading-tight text-red-600">{run.error}</p>
      ) : adds.length ? (
        <p className="mt-1 text-[11px] leading-tight text-gray-700">
          {/* The payload is missing until someone types it, so the booking is
              only half-arrived — say that here rather than let it surface later
              as a Missing Profit modal with no explanation. */}
          Booked {adds.join(", ")} — add the payout
        </p>
      ) : stale ? (
        <p className="mt-1 text-[11px] leading-tight text-gray-500">
          Nothing since then. Sync by hand if a booking is missing.
        </p>
      ) : (
        <p className="mt-1 text-[11px] leading-tight text-gray-500">
          Checked AirBnB, nothing new. Runs every 30 minutes.
        </p>
      )}
    </div>
  );
};

export default AutoSyncStatus;
