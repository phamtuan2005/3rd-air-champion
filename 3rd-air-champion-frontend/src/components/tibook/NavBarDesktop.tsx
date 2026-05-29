import { useState } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { ThemeName } from "../../contexts/TiBookThemeContext";
import type { hostType } from "../../util/types/hostType";

const SWATCHES: { name: ThemeName; bg: string }[] = [
  { name: "green",  bg: "bg-green-500"  },
  { name: "amber",  bg: "bg-amber-500"  },
  { name: "teal",   bg: "bg-teal-500"   },
  { name: "rose",   bg: "bg-rose-500"   },
  { name: "indigo", bg: "bg-indigo-500" },
];

interface NavBarDesktopProps {
  onBack?: () => void;
  host?: hostType | null;
  cohostNames?: string[];
  isFullCalendar?: boolean;
  onMyBookings?: () => void;
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

const NavBarDesktop = ({ onBack, host, cohostNames = [], isFullCalendar = false, onMyBookings }: NavBarDesktopProps) => {
  const { theme, setTheme } = useTiBookTheme();

  return (
    <nav className="px-3 flex items-center gap-2 w-full h-12 sm:h-16 bg-white drop-shadow-md z-50 shrink-0">
      <img
        className="h-8 w-8 sm:h-10 sm:w-10"
        alt="TT House Logo"
        title="TT House Logo"
        src="./TiMagLogo.svg"
      />
      {isFullCalendar && host ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center">
            <MiniAvatar name={host.name} />
            {cohostNames.map((name) => (
              <div key={name} className="-ml-2">
                <MiniAvatar name={name} />
              </div>
            ))}
          </div>
          <span className="text-sm sm:text-base font-bold tracking-wide text-gray-800">
            Book with TT House
          </span>
        </div>
      ) : (
        <h1 className="text-sm sm:text-base font-bold tracking-wide text-gray-800 flex-1">
          TiBook · Book with TT House
        </h1>
      )}
      <div className="flex items-center gap-2">
        {onMyBookings && (
          <button
            type="button"
            onClick={onMyBookings}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Your bookings
          </button>
        )}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            {SWATCHES.map((s) => (
              <button
                key={s.name}
                type="button"
                title={s.name}
                onClick={() => setTheme(s.name)}
                className={`w-5 h-5 rounded-full ${s.bg} transition-transform ${
                  theme.name === s.name ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBarDesktop;