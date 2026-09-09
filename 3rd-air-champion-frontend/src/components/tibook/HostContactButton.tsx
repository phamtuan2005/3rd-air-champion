import { useEffect, useRef, useState } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

interface HostContactButtonProps {
  hostName: string;
  hostPhone?: string;
  // Replies waiting for the guest, shown as a count on the button so a guest
  // who closed the sheet still learns the host wrote back.
  unread?: number;
  onOpenChat: () => void;
}

const SIZE = 56; // px — the button is a square, and the maths below assumes it
const EDGE = 12; // smallest gap we let it keep from any edge
const DRAG_SLOP = 6; // px of movement before a press counts as a drag, not a tap

const POS_KEY = "tiBookHostButtonPos";
const HINT_KEY = "tiBookHostButtonHintSeen";

interface Pos {
  x: number;
  y: number;
}

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

// Keeps the button whole and on screen. Called on every move, on mount and on
// every resize — a phone rotating from landscape to portrait would otherwise
// leave the button parked off the side of the screen with no way to get it
// back, which is worse than it sounds: this button is how a guest asks for
// help, so losing it strands exactly the guest who needed it.
const clampToViewport = (p: Pos): Pos => {
  const { w, h } = viewport();
  const maxX = Math.max(EDGE, w - SIZE - EDGE);
  const maxY = Math.max(EDGE, h - SIZE - EDGE);
  return {
    x: Math.min(Math.max(p.x, EDGE), maxX),
    y: Math.min(Math.max(p.y, EDGE), maxY),
  };
};

// Bottom right, clear of the action bar that appears once a guest has dates
// picked. Only used until the guest moves it themselves.
const defaultPos = (): Pos => {
  const { w, h } = viewport();
  return clampToViewport({ x: w - SIZE - 16, y: h - SIZE - 96 });
};

const readStoredPos = (): Pos | null => {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x !== "number" || typeof parsed?.y !== "number") return null;
    return parsed;
  } catch {
    // Private windows and blocked site data both throw here. Where the guest
    // parked it is a convenience, never a reason to fail to render the button.
    return null;
  }
};

const HostContactButton = ({
  hostName,
  hostPhone,
  unread = 0,
  onOpenChat,
}: HostContactButtonProps) => {
  const { theme } = useTiBookTheme();
  const [pos, setPos] = useState<Pos>(() => readStoredPos() ?? defaultPos());
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(false);

  // Mount-time clamp. The stored position came from whatever screen the guest
  // last used, which may have been a wider one.
  useEffect(() => {
    setPos((p) => clampToViewport(p));
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // A button that can be moved is worth nothing if nobody knows it moves. Said
  // once per device, then never again.
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      return;
    }
    setHint(true);
    const t = setTimeout(() => setHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const dismissHint = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Nothing to do — worst case the hint shows again next visit.
    }
  };

  // Everything the drag needs that must NOT cause a re-render while the finger
  // is down: the grab offset, where the press started, and whether it has
  // travelled far enough to stop being a tap.
  const drag = useRef({ active: false, moved: false, dx: 0, dy: 0, sx: 0, sy: 0 });

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      moved: false,
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      sx: e.clientX,
      sy: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const travelled = Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy);
    // A tap on a touchscreen always wanders a pixel or two. Without the slop
    // every tap would read as a tiny drag and the menu would never open.
    if (!drag.current.moved && travelled > DRAG_SLOP) {
      drag.current.moved = true;
      setDragging(true);
      setOpen(false);
      dismissHint();
    }
    if (!drag.current.moved) return;
    setPos(clampToViewport({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const wasDrag = drag.current.moved;
    drag.current.active = false;
    drag.current.moved = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released — the pointer left the window, say.
    }
    if (wasDrag) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        // See readStoredPos — a lost position is not worth an error.
      }
      return;
    }
    setOpen((o) => !o);
    dismissHint();
  };

  // Which way the menu unfolds. It hangs off whichever corner keeps it on
  // screen, so the menu follows the button into any corner the guest parks it
  // in rather than running off the edge.
  const { w, h } = viewport();
  const onLeft = pos.x + SIZE / 2 < w / 2;
  const onTop = pos.y + SIZE / 2 < h / 2;
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    ...(onLeft ? { left: pos.x } : { right: Math.max(EDGE, w - pos.x - SIZE) }),
    ...(onTop ? { top: pos.y + SIZE + 10 } : { bottom: Math.max(EDGE, h - pos.y + 10) }),
    maxWidth: "calc(100vw - 24px)",
  };

  const smsHref = hostPhone
    ? "sms:" + hostPhone + "?&body=" + encodeURIComponent("Hi " + hostName + ", ")
    : undefined;

  const Option = ({
    icon,
    title,
    detail,
    onClick,
    href,
    badge,
  }: {
    icon: React.ReactNode;
    title: string;
    detail: string;
    onClick?: () => void;
    href?: string;
    badge?: number;
  }) => {
    const inner = (
      <>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${theme.tagBg} ${theme.tagText}`}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col text-left">
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${theme.surfaceText}`}>
            {title}
            {!!badge && badge > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold text-white">
                {badge}
              </span>
            )}
          </span>
          <span className={`text-[11px] leading-tight ${theme.surfaceMuted}`}>{detail}</span>
        </span>
      </>
    );
    const cls = `flex w-full items-center gap-3 px-3 py-2.5 transition-colors ${theme.surfaceHover2}`;
    return href ? (
      <a href={href} className={cls} onClick={() => setOpen(false)}>
        {inner}
      </a>
    ) : (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  };

  return (
    <>
      {/* Closes the menu on a tap anywhere else. Transparent, and below both the
          menu and the button so the two of them stay live. */}
      {open && (
        <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {open && (
        <div
          style={menuStyle}
          className={`tibook-type z-[62] w-64 overflow-hidden rounded-2xl border shadow-2xl ${theme.surface} ${theme.surfaceBorder}`}
          role="menu"
        >
          <div className={`border-b px-3 pb-1.5 pt-2.5 ${theme.surfaceBorder}`}>
            <p className={`text-sm font-bold ${theme.surfaceText}`}>Ask {hostName}</p>
            <p className={`text-[11px] leading-snug ${theme.surfaceMuted}`}>
              Anything at all — he answers these himself.
            </p>
          </div>

          <Option
            badge={unread}
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 10h8M8 14h5m-9 7l3.5-3.5H18a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v14z"
                />
              </svg>
            }
            title="Chat here"
            detail={`Stays in TiBook. ${hostName} replies on this screen.`}
            onClick={() => {
              setOpen(false);
              onOpenChat();
            }}
          />

          {smsHref && (
            <Option
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              }
              title="Text his phone"
              detail="Opens your messages, ready to send."
              href={smsHref}
            />
          )}

          {hostPhone && (
            <Option
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h2.2a1 1 0 01.98.8l.7 3.4a1 1 0 01-.5 1.06l-1.6.9a13 13 0 006.06 6.06l.9-1.6a1 1 0 011.06-.5l3.4.7a1 1 0 01.8.98V19a2 2 0 01-2 2h-1C9.6 21 3 14.4 3 6V5z"
                  />
                </svg>
              }
              title="Call him"
              detail="Rings his phone now."
              href={`tel:${hostPhone}`}
            />
          )}

          {!hostPhone && (
            <p className={`px-3 py-2 text-[11px] ${theme.surfaceMuted}`}>
              Chat is the quickest way to reach him today.
            </p>
          )}
        </div>
      )}

      {hint && !open && (
        <div
          style={{
            position: "fixed",
            ...(onLeft ? { left: pos.x + SIZE + 8 } : { right: Math.max(EDGE, w - pos.x) + 8 }),
            top: pos.y + SIZE / 2 - 14,
          }}
          className={`tibook-type pointer-events-none z-[61] whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-lg ${theme.surface} ${theme.surfaceBorder} ${theme.surfaceText}`}
        >
          Ask {hostName} — drag me anywhere
        </div>
      )}

      <button
        type="button"
        aria-label={`Contact ${hostName}. Drag to move this button.`}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: SIZE,
          height: SIZE,
          // The browser must not pan the page while a finger is dragging the
          // button — without this, a drag on a touchscreen scrolls the calendar
          // underneath instead of moving the button.
          touchAction: "none",
        }}
        className={`tibook-type z-[60] flex items-center justify-center rounded-full text-white shadow-xl ${theme.btn} ${theme.glow} ${theme.btnMotion} ${theme.focusRing} ${
          dragging ? "scale-110 cursor-grabbing" : "cursor-grab active:scale-95"
        } transition-transform`}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h8M8 14h5m-9 7l3.5-3.5H18a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v14z"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
};

export default HostContactButton;
