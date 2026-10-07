import { useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { Habit, Proposal } from "../../util/bookingHabit";

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
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon → Fri, 4 nights" or "Thursday night". */
export const habitLabel = (h: Habit) =>
  h.nights === 1 ? `${DAY[h.startWeekday]} night` : `${SHORT[h.startWeekday]} → ${SHORT[(h.startWeekday + h.nights) % 7]}, ${h.nights} nights`;

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
  proposals,
  fill,
  roomOf,
  onRequest,
  onClose,
}: {
  firstName: string;
  habits: Habit[];
  proposals: Proposal[];
  /** How many of the coming weeks the guest's usual room is already taken on their nights. */
  fill: { taken: number; known: number };
  roomOf: (id: string) => { name: string; color?: string } | undefined;
  onRequest: (p: Proposal) => void;
  onClose: () => void;
}) => {
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
        TT has {proposals.length} stay{proposals.length === 1 ? "" : "s"} for you
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
          TT noted that you usually stay <span className="font-semibold">{habits.slice(0, 2).map(habitLabel).join(" and ")}</span>
          {usual ? (
            <>
              {" "}in{" "}
              <span className={`${roomChip(usual)} rounded-md px-1.5 py-0.5 font-bold text-black`}>{usual.name}</span>
            </>
          ) : null}
          .
        </p>
        <p className={`mt-2 text-sm ${theme.surfaceMuted}`}>
          {goingFast && usual
            ? `${usual.name} is already booked ${fill.taken} of the next ${fill.known} weeks on those nights. These are still open:`
            : "These are still open in the coming weeks — book ahead:"}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {proposals.map((p) => {
            const room = roomOf(p.roomId);
            return (
              <button
                key={`${p.start}-${p.roomId}`}
                type="button"
                onClick={() => onRequest(p)}
                className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-base font-semibold text-white ${theme.btn} ${theme.btnHover}`}
              >
                <span>
                  {stayDates(p)}
                  {!p.usualRoom && usual && (
                    <span className="block text-xs font-normal opacity-90">{usual.name} is taken that week — another room you've stayed in</span>
                  )}
                </span>
                {room && (
                  <span className={`${roomChip(room)} shrink-0 rounded-md px-2 py-0.5 text-sm font-bold text-black`}>{room.name}</span>
                )}
              </button>
            );
          })}
        </div>

        <p className={`mt-3 text-xs ${theme.surfaceMuted}`}>Tap a stay to see the request — nothing is sent until you send it.</p>
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
