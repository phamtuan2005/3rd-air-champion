import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { hostOnSite, houseBathrooms } from "../../util/roomFacts";

interface HouseFactsStripProps {
  // The full host name, as the avatar file in /public is named after it. The
  // sentence itself only uses the first name.
  hostName?: string;
}

// The two facts about the whole house that a guest weighs before they get as
// far as choosing a room, put where they meet them first instead of two taps
// into a gallery.
//
// One answers the question a stranger asks about a room in somebody else's
// home: who is looking after it. The other is the thing the AirBnB titles sell
// the house on, and it was only findable per-room. Both are reassurance, so
// they belong above the rooms and the calendar rather than behind them.
//
// Kept to ONE band of two lines: this sits above the calendar in the header
// stack, and every pixel here is a pixel of calendar on a short phone. The
// guest can pull the calendar straight over it once they have read it.
//
// House-level on purpose, not a chip on each of the five cards. A fact copied
// onto five rooms drifts apart, and King already lost a duplicated "Kitchen"
// chip for exactly that reason.
//
// The shared kitchen was briefly here too and was taken out again. It is a
// room-by-room answer about what is yours alone and what is everybody's, so it
// belongs beside a room's bathroom in that room's gallery, which is where it
// still is.
const HouseFactsStrip = ({ hostName }: HouseFactsStripProps) => {
  const { theme } = useTiBookTheme();
  const hostFirstName = (hostName ?? "").split(" ")[0];

  return (
    <div className={`tibook-type shrink-0 border-b ${theme.tagBorder} ${theme.tagBg}`}>
      <ul className="flex flex-col gap-1 px-4 py-1.5 sm:flex-row sm:items-center sm:gap-5">
        <li className="flex min-w-0 items-center gap-1.5">
          {/* The host's own face, not a house icon. "Somebody lives here" is a
              claim about a person, and it is the same photo the guest can see
              in the banner directly above, with the green dot that means
              present. Falls back to nothing rather than a broken image: the
              sentence beside it carries the fact on its own. */}
          <span className="relative flex h-4 w-4 shrink-0">
            <img
              src={`/${hostName}.jpg`}
              alt=""
              className="h-4 w-4 rounded-full border border-white object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <span className="absolute -bottom-px -right-px h-1.5 w-1.5 rounded-full border border-white bg-green-500" />
          </span>
          <span className={`text-xs font-semibold leading-tight ${theme.tagText}`}>
            {hostOnSite(hostFirstName)}
          </span>
        </li>
        <li className="flex min-w-0 items-center gap-1.5">
          {/* A droplet, drawn inline rather than an emoji. The frying pan that
              used to sit in this strip rendered at 16px as a magnifying glass,
              which means "search" everywhere else in this app; an inline glyph
              is crisp at that size and takes the theme colour, so it matches
              the sentence beside it. */}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 ${theme.tagText}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z" />
          </svg>
          <span className={`text-xs font-semibold leading-tight ${theme.tagText}`}>
            {houseBathrooms}
          </span>
        </li>
      </ul>
    </div>
  );
};

export default HouseFactsStrip;
