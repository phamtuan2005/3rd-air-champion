import { useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { Habit, Proposal, Series } from "../../util/bookingHabit";

// TiBook coming forward to a regular: "your usual, the next weeks it is open,
// tap to request" — instead of waiting for them to find the dates themselves
// while their room's weekdays fill up (host, 2026-10-07: "TiBook should be
// proactive to help the returning guests, proposing the booking for them").
//
// A POPUP over the page, at TiBook's popup type scale (`tibook-type`): a strip
// under the header was too small to read and too easy to miss (host, same
// day). It opens once per visit, after anything else that opens on arrival.
//
// A FLOATING window (host, same day): drag it by its title bar, resize it from
// the corner, minimise it to a small bar. Minimised, it covers nothing — no
// dimmed backdrop, the page underneath works as if it were closed — and one tap
// brings it back where it was. The same drag/resize handling as TiMag's floating
// panels (MiscModal), on pointer events so a finger and a mouse both work.
//
// A proposal only ever opens the ordinary booking request, filled in; the guest
// still reads it and sends it. Nothing is booked from here.

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The nights a guest stays, the way a person says them: "Tuesday and Wednesday
 * nights", "Monday through Thursday nights", "Monday and Thursday nights".
 *
 * Every habit's nights together, in week order (Monday first). The first
 * wording — "Tue → Thu, 2 nights and Wednesday night" — was how a program counts
 * a stay, two overlapping patterns glued together, and a guest could not tell
 * what it meant (host, 2026-10-07).
 */
export const nightsPhrase = (habits: Habit[]) => {
  const set = new Set<number>();
  for (const h of habits) for (let i = 0; i < h.nights; i++) set.add((h.startWeekday + i) % 7);
  // Monday-first: Mon=0 … Sun=6.
  const order = [...set].map((d) => (d + 6) % 7).sort((a, b) => a - b);
  const name = (m: number) => DAY[(m + 1) % 7];
  const consecutive = order.every((m, i) => i === 0 || m === order[i - 1] + 1);
  if (order.length === 1) return `${name(order[0])} nights`;
  if (consecutive && order.length >= 3) return `${name(order[0])} through ${name(order[order.length - 1])} nights`;
  const names = order.map(name);
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} nights`;
};

const stayDates = (p: Proposal) => {
  const a = parseISO(p.start);
  const out = addDays(a, p.nights.length);
  return p.nights.length === 1
    ? format(a, "EEE, MMM d")
    : a.getMonth() === out.getMonth()
      ? `${format(a, "EEE MMM d")} – ${format(out, "d")}`
      : `${format(a, "EEE MMM d")} – ${format(out, "MMM d")}`;
};

const UsualStayCard = ({
  firstName,
  habits,
  series,
  fill,
  roomOf,
  onRequest,
  onClose,
}: {
  firstName: string;
  habits: Habit[];
  /** The next months of stays, after the guest's last booked one (bookingHabit.seriesFor). */
  series: Series;
  /** How many of the coming weeks the guest's usual room is already taken on their nights. */
  fill: { taken: number; known: number };
  roomOf: (id: string) => { name: string; color?: string } | undefined;
  /** The ticked stays, to the ordinary request — the guest still sends it. */
  onRequest: (stays: Proposal[]) => void;
  onClose: () => void;
}) => {
  const proposals = series.proposals;
  // Every week ticked to start with; the guest unticks the ones they will not need.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(proposals.map((p) => p.start)));
  const chosen = proposals.filter((p) => picked.has(p.start));
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const main = habits[0];
  const usual = roomOf(main.rooms[0]);
  // Said only when it is true and worth saying: at least three weeks seen, and
  // the room taken on half or more of them.
  const goingFast = fill.known >= 3 && fill.taken / fill.known >= 0.5;

  // ── Floating: position, size, minimised ──────────────────────────────────
  const initW = Math.min(400, window.innerWidth - 24);
  const initH = Math.min(560, window.innerHeight - 24);
  const [size, setSize] = useState({ w: initW, h: initH });
  const [pos, setPos] = useState({
    x: Math.max(12, (window.innerWidth - initW) / 2),
    y: Math.max(12, (window.innerHeight - initH) / 2),
  });
  const [minimised, setMinimised] = useState(false);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    // A tap on the title-bar buttons is a tap, not the start of a drag.
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    // Kept on screen: the title bar can never be dragged out of reach.
    setPos({
      x: Math.min(window.innerWidth - 80, Math.max(-size.w + 80, d.px + (e.clientX - d.x))),
      y: Math.min(window.innerHeight - 48, Math.max(0, d.py + (e.clientY - d.y))),
    });
  };
  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    resizeRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    setSize({
      w: Math.min(window.innerWidth - 12, Math.max(280, r.w + (e.clientX - r.x))),
      h: Math.min(window.innerHeight - 12, Math.max(240, r.h + (e.clientY - r.y))),
    });
  };

  if (minimised) {
    // Out of the way and covering nothing; one tap brings the window back.
    return (
      <button
        type="button"
        onClick={() => setMinimised(false)}
        className={`tibook-type fixed bottom-24 left-1/2 z-[130] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-xl ${theme.btn} ${theme.btnHover}`}
      >
        <span aria-hidden>★</span>
        TT has {proposals.length} stay{proposals.length === 1 ? "" : "s"} lined up for you
        <span aria-hidden className="opacity-80">▲</span>
      </button>
    );
  }

  return (
    <>
      {/* Dimmed behind the window while it is open; a tap there closes it. */}
      <div className={`fixed inset-0 z-[129] ${theme.scrim}`} onClick={onClose} />
      <div
        role="dialog"
        aria-label="Stays to book ahead"
        className={`tibook-type fixed z-[130] flex flex-col overflow-hidden rounded-2xl shadow-2xl ${theme.surface}`}
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        {/* Title bar: drag to move. */}
        <div
          className={`flex shrink-0 cursor-move touch-none select-none items-center justify-between gap-2 border-b px-4 py-2.5 ${theme.surfaceBorder}`}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={() => (dragRef.current = null)}
        >
          <p className={`truncate text-lg font-bold ${theme.surfaceStrong}`}>{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimised(true)}
              aria-label="Minimise"
              title="Minimise"
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none ${theme.surfaceMuted}`}
            >
              –
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none ${theme.surfaceMuted}`}
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        {/* "TT noted that…", not "your habit" — the house's assistant noticing,
            the way a host who knows a regular would say it (host, 2026-10-07). */}
        <p className={`text-base ${theme.surfaceText}`}>
          TT noted that you usually stay <span className="font-semibold">{nightsPhrase(habits)}</span>
          {usual ? (
            <>
              {" "}in{" "}
              <span className={`${roomChip(usual)} rounded-md px-1.5 py-0.5 font-bold text-black`}>{usual.name}</span>
            </>
          ) : null}
          .
        </p>
        {series.lastBooked && (
          <p className={`mt-1 text-base ${theme.surfaceText}`}>
            You're booked up to <span className="font-semibold">{format(parseISO(series.lastBooked), "EEEE, MMMM d, yyyy")}</span>.
          </p>
        )}
        <p className={`mt-2 text-sm ${theme.surfaceMuted}`}>
          TT can line up the next ones for you, to {format(parseISO(series.until), "MMMM yyyy")}
          {goingFast && usual ? ` — ${usual.name} is already booked ${fill.taken} of the next ${fill.known} weeks on those nights` : ""}.
          Untick any week you won't need.
        </p>

        <button
          type="button"
          onClick={() => chosen.length > 0 && onRequest(chosen)}
          disabled={chosen.length === 0}
          className={`mt-3 w-full rounded-xl px-4 py-3 text-base font-bold text-white disabled:opacity-40 ${theme.btn} ${theme.btnHover}`}
        >
          Request {chosen.length === proposals.length ? "all " : ""}
          {chosen.length} stay{chosen.length === 1 ? "" : "s"}
        </button>

        {/* The weeks, by month, each with its room. A week where the usual room
            is taken offers another free room (theirs first), and says so. */}
        <div className="mt-3">
          {proposals.map((p, i) => {
            const room = roomOf(p.roomId);
            const month = format(parseISO(p.start), "MMMM yyyy");
            const newMonth = i === 0 || format(parseISO(proposals[i - 1].start), "MMMM yyyy") !== month;
            const on = picked.has(p.start);
            return (
              <div key={`${p.start}-${p.roomId}`}>
                {newMonth && <p className={`mb-1 mt-2 text-xs font-bold uppercase tracking-wide ${theme.surfaceMuted}`}>{month}</p>}
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${on ? "" : "opacity-50"}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.start)) next.delete(p.start);
                        else next.add(p.start);
                        return next;
                      })
                    }
                    className="h-5 w-5 shrink-0"
                  />
                  <span className={`min-w-0 flex-1 text-base ${theme.surfaceText}`}>
                    {stayDates(p)}
                    {p.completes ? (
                      // A night to round off a week they booked part of.
                      <span className="block text-xs font-semibold text-emerald-600">
                        adds to your {[...new Set(p.completes)].map((d) => DAY[d]).join(" and ")} stay
                      </span>
                    ) : (
                      !p.usualRoom &&
                      usual && <span className={`block text-xs ${theme.surfaceMuted}`}>{usual.name} is taken that week</span>
                    )}
                  </span>
                  {room && <span className={`${roomChip(room)} shrink-0 rounded-md px-2 py-0.5 text-sm font-bold text-black`}>{room.name}</span>}
                </label>
              </div>
            );
          })}
        </div>

        <p className={`mt-3 text-xs ${theme.surfaceMuted}`}>You'll see the request before anything is sent — each stay goes to the host on its own.</p>
        <button type="button" onClick={onClose} className={`mt-3 w-full rounded-xl py-2.5 text-base font-semibold ${theme.surfaceMuted}`}>
          Not now
        </button>
        </div>

        {/* Corner grip: drag to resize. */}
        <div
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={() => (resizeRef.current = null)}
          className="absolute bottom-0 right-0 flex h-6 w-6 cursor-nwse-resize touch-none items-end justify-end p-1"
          aria-label="Resize"
        >
          <span className="h-3 w-3 rounded-br-md border-b-2 border-r-2 border-gray-400" />
        </div>
      </div>
    </>
  );
};

export default UsualStayCard;
