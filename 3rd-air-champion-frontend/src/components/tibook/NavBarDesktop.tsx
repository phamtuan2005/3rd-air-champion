import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { ThemeName } from "../../contexts/TiBookThemeContext";

const SWATCHES: { name: ThemeName; bg: string }[] = [
  { name: "green",  bg: "bg-green-500"  },
  { name: "amber",  bg: "bg-amber-500"  },
  { name: "teal",   bg: "bg-teal-500"   },
  { name: "rose",   bg: "bg-rose-500"   },
  { name: "indigo", bg: "bg-indigo-500" },
];

const NavBarDesktop = () => {
  const { theme, setTheme } = useTiBookTheme();

  return (
    <nav className="px-3 flex items-center gap-2 w-full h-12 sm:h-16 bg-white drop-shadow-md z-50 shrink-0">
      <img
        className="h-8 w-8 sm:h-10 sm:w-10"
        alt="TT House Logo"
        title="TT House Logo"
        src="./TiMagLogo.svg"
      />
      <h1 className="text-sm sm:text-base font-bold tracking-wide text-gray-800 flex-1">
        TiBook · Book with TT House
      </h1>
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
    </nav>
  );
};

export default NavBarDesktop;