import { useEffect, useRef, useState } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { hostType } from "../../util/types/hostType";
import { getLoyaltyTier } from "./GuestLoyaltyBanner";

interface NavBarDesktopProps {
  onBack?: () => void;
  host?: hostType | null;
  cohostNames?: string[];
  isFullCalendar?: boolean;
  onMyBookings?: () => void;
  guestName?: string; // recognized guest → the "Your bookings" pill greets them by name
  guestStays?: number; // total stays → loyalty tier badge on the pill
}

const MiniAvatar = ({ name }: { name: string }) => {
  const [error, setError] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="h-7 w-7 rounded-full border-2 border-green-500 overflow-hidden bg-green-100 flex items-center justify-center flex-shrink-0">
      {!error ? (
        <img src={`/${name}.jpg`} alt={name} className="h-full w-full object-cover" onError={() => setError(true)} />
      ) : (
        <span className="text-green-700 font-bold text-[10px]">{initials}</span>
      )}
    </div>
  );
};

const NavBarDesktop = ({ onBack, host, cohostNames = [], isFullCalendar = false, onMyBookings, guestName, guestStays }: NavBarDesktopProps) => {
  const { theme } = useTiBookTheme();
  const guestFirstName = guestName?.trim().split(" ")[0];
  const loyaltyTier = guestStays ? getLoyaltyTier(guestStays) : null;

  return (
    <nav
      /* bg-white was hardcoded here. It is a token now so the vivid skin can
         take the bar dark without this component knowing a skin exists. */
      className={`px-3 flex items-center gap-2 w-full h-12 sm:h-16 ${theme.chrome} drop-shadow-md z-50 shrink-0`}
    >
      <img
        className="h-8 w-8 sm:h-10 sm:w-10"
        alt="TT House Logo"
        title="TT House Logo"
        src="./TiMagLogo.svg"
      />
      {isFullCalendar && host ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center">
            <MiniAvatar name={host.name} />
            {cohostNames.map((name) => (
              <div key={name} className="-ml-2">
                <MiniAvatar name={name} />
              </div>
            ))}
          </div>
          <span className={`text-sm sm:text-base font-bold tracking-wide truncate ${theme.chromeText}`}>
            <span className="sm:hidden">TT House</span>
            <span className="hidden sm:inline">Book with TT House</span>
          </span>
        </div>
      ) : (
        <h1 className={`text-sm sm:text-base font-bold tracking-wide flex-1 min-w-0 truncate ${theme.chromeText}`}>
          <span className="sm:hidden">TiBook</span>
          <span className="hidden sm:inline">TiBook · Book with TT House</span>
        </h1>
      )}
      <div className="flex items-center gap-2">
        {onMyBookings && (
          <button
            type="button"
            onClick={onMyBookings}
            title="Your bookings"
            /* Sized by hand rather than by the tibook-type scale: the nav has a
               fixed h-12/h-16 and the scale moves --spacing, which would grow the
               bar and take that height off the calendar. The guest's own name is
               a greeting, so it reads at the same size as the house name it sits
               beside instead of at badge size. */
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${theme.chromeBorder} ${theme.chromeHover} ${
              guestFirstName ? theme.chromeAccent : theme.chromeMuted
            }`}
          >
            {guestFirstName ? (
              <>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${theme.btn} text-[11px] font-bold text-white`}
                >
                  {guestFirstName[0].toUpperCase()}
                </span>
                {guestFirstName}
                {loyaltyTier && (
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[11px] font-bold leading-none ${loyaltyTier.color}`}
                    title={loyaltyTier.label}
                  >
                    {loyaltyTier.label.split(" ")[0]}
                  </span>
                )}
              </>
            ) : (
              "Your bookings"
            )}
          </button>
        )}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${theme.chromeBorder} ${theme.chromeMuted} ${theme.chromeHover}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
        ) : (
          <AppearanceMenu />
        )}
      </div>
    </nav>
  );
};

/*
 * Look and colour, in one menu behind one button.
 *
 * They used to sit inline in the bar: a two-segment toggle plus five swatches.
 * That is about 160px of fixed width added to a bar that already carries the
 * logo, the house name and the bookings pill, and the bar is a fixed h-12 on a
 * phone so nothing can wrap. On anything narrower than about 400px the row ran
 * off the right edge and the last colour was simply unreachable — the guest
 * could see four of five and had no way to know a fifth existed.
 *
 * A menu costs one 28px button instead, so it fits at any width, and the two
 * choices get room for their names. Five unlabelled dots never said that a
 * colour was being chosen, and a flat dot beside a gradient one never said
 * that it was the whole look.
 *
 * Labelled by what the guest gets — "Classic" and "Neon" — rather than by who
 * we think they are. TiBook is read by the person booking the room, and being
 * told which generation a page thinks you belong to is a worse greeting than
 * being shown the two looks and asked which you prefer.
 */
const LOOKS = [
  { key: "classic" as const, label: "Classic", hint: "Calm and plain", dot: "bg-gray-400" },
  { key: "vivid" as const, label: "Neon", hint: "Dark and bright", dot: "bg-gradient-to-r from-fuchsia-500 to-cyan-400" },
];

/*
 * Shown once, to a guest who has never opened the menu.
 *
 * The trigger was a bare dot with a hairline round it. It is the current
 * palette, which is honest, but to somebody arriving for the first time a
 * coloured circle in the corner is decoration — nothing about it says it can be
 * pressed, and nothing says what would happen. A guest cannot choose a look
 * they never learn is there.
 *
 * So the button says what it is (a caret, and the word on any screen with room
 * for it), and this says it once in words. It is a nudge, not a gate: it sits
 * under the button it is pointing at, it never covers the calendar, and it goes
 * for good the moment the guest opens the menu or dismisses it.
 */
const HINT_KEY = "tiBookLookHintSeen";

const readHintSeen = () => {
  // Private browsing can throw on access rather than return null. A guest who
  // cannot be remembered should still get TiBook, so a throw means "seen" —
  // better a nudge that never shows than a nav that will not render.
  try {
    // A guest with a saved look has already found this menu, in an earlier
    // visit or before the nudge existed. Telling them where it is would be the
    // app not noticing what they have already done.
    return localStorage.getItem(HINT_KEY) === "1" || localStorage.getItem("tiBookVibe") !== null;
  } catch {
    return true;
  }
};

const AppearanceMenu = () => {
  const { theme, setTheme, vibe, setVibe, allThemes } = useTiBookTheme();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Held back a beat rather than shown on mount: it arrives after the page has
  // settled, so it reads as a nudge about the button rather than as one more
  // thing loading in.
  useEffect(() => {
    if (readHintSeen()) return;
    const t = setTimeout(() => setHint(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const dismissHint = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Nothing to do — it shows again next visit, which is the harmless way
      // round for a one-line nudge.
    }
  };

  const toggle = () => {
    setOpen((o) => !o);
    if (hint) dismissHint();
  };

  // Closes on a tap anywhere else and on Escape. Without the first, the panel
  // sits over the calendar the guest is trying to get back to, and the only way
  // out is to find the same small button again. A tap outside puts the nudge
  // away too — having answered it by ignoring it is an answer.
  useEffect(() => {
    if (!open && !hint) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      if (hint) dismissHint();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (hint) dismissHint();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hint]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change how TiBook looks"
        title="Change how TiBook looks"
        className={`relative flex items-center gap-1 rounded-full border pl-1 pr-1.5 py-1 transition-colors ${theme.chromeBorder} ${theme.chromeHover} ${theme.chromeText}`}
      >
        {/* One soft ring, only while the nudge is up, and only ever once. It
            stops the moment the guest has seen the menu, and it bows out
            entirely under prefers-reduced-motion — a pulsing dot beside a
            booking calendar is exactly what that setting is turned on to
            avoid. */}
        {hint && (
          <span
            aria-hidden
            className={`tibook-attention pointer-events-none absolute inset-0 rounded-full ${theme.btn} opacity-40`}
          />
        )}
        {/* The trigger wears the current answer: the palette dot in the skin it
            is currently rendered in. */}
        <span className={`relative h-5 w-5 shrink-0 rounded-full ${theme.btn}`} />
        <span className="relative hidden text-xs font-semibold sm:inline">Look</span>
        {/* A caret is the part that says "this opens something". It stays on the
            narrowest phone, where the word does not fit. */}
        <svg
          aria-hidden
          className={`relative h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {hint && !open && (
        <div
          role="note"
          className={`absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border p-3 shadow-xl ${theme.surface} ${theme.chromeBorder}`}
        >
          {/* Points at the button, so the sentence and the thing it is about
              are visibly the same thing. */}
          <span
            aria-hidden
            className={`absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t ${theme.surface} ${theme.chromeBorder}`}
          />
          <div className="relative flex items-start gap-2">
            <p className={`flex-1 text-xs leading-snug ${theme.surfaceText}`}>
              <span className="font-bold">Make it yours.</span>{" "}
              Tap here for Classic or Neon, in the colour you like.
            </p>
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Dismiss"
              className={`shrink-0 text-sm leading-none ${theme.surfaceMuted} ${theme.mutedHover}`}
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={toggle}
            className={`relative mt-2 w-full rounded-full py-1.5 text-xs font-semibold text-white ${theme.btn} ${theme.btnHover} ${theme.glow}`}
          >
            Show me
          </button>
        </div>
      )}

      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border shadow-xl ${theme.surface} ${theme.chromeBorder}`}
        >
          <p className={`px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide ${theme.surfaceMuted}`}>
            Look
          </p>
          {LOOKS.map((o) => {
            const on = vibe === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => setVibe(o.key)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${theme.chromeHover}`}
              >
                <span className={`h-4 w-4 shrink-0 rounded-full ${o.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold leading-tight ${theme.surfaceText}`}>{o.label}</span>
                  <span className={`block text-[11px] leading-tight ${theme.surfaceMuted}`}>{o.hint}</span>
                </span>
                {on && (
                  <svg className={`h-4 w-4 shrink-0 ${theme.chromeAccent}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}

          <div className={`mt-1 border-t ${theme.surfaceBorder}`} />
          <p className={`px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide ${theme.surfaceMuted}`}>
            Colour
          </p>
          <div className="flex items-center gap-2 px-3 pb-3 pt-0.5">
            {/* Drawn from the skin in use, not from a fixed list of flat
                colours: in the neon skin these dots are the gradients the guest
                will actually get, so the swatch shows the answer rather than an
                approximation of it. */}
            {allThemes.map((s) => (
              <button
                key={s.name}
                type="button"
                role="menuitemradio"
                aria-checked={theme.name === s.name}
                title={s.name}
                aria-label={`${s.name} colour`}
                onClick={() => setTheme(s.name)}
                className={`h-6 w-6 rounded-full ${s.btn} transition-transform ${
                  theme.name === s.name
                    ? `ring-2 ring-offset-2 ${theme.ringOffset} ${theme.chromeRing} scale-110`
                    : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavBarDesktop;
