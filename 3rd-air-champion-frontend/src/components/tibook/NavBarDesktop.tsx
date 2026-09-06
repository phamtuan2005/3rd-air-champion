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

const AppearanceMenu = () => {
  const { theme, setTheme, vibe, setVibe, allThemes } = useTiBookTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Closes on a tap anywhere else and on Escape. Without the first, the panel
  // sits over the calendar the guest is trying to get back to, and the only way
  // out is to find the same small button again.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Look and colour"
        title="Look and colour"
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${theme.chromeBorder} ${theme.chromeHover}`}
      >
        {/* The trigger wears the current answer: the palette dot in the skin it
            is currently rendered in. */}
        <span className={`h-4 w-4 rounded-full ${theme.btn}`} />
      </button>

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
