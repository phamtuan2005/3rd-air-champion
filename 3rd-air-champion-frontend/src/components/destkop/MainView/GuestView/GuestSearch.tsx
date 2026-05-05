import { useMemo, useRef, useState } from "react";
import { dayType } from "../../../../util/types/dayType";
import { guestType } from "../../../../util/types/guestType";
import { getRoomColor } from "../../../../util/getRoomColor";
import { format, parseISO } from "date-fns";

interface SearchResult {
  type: "regular" | "airbnb";
  id?: string;
  alias: string;
  roomName: string;
  roomColor?: string;
  latestDate: string;
}

interface GuestSearchProps {
  guests: guestType[];
  monthMap: Map<string, dayType>;
  onSelectGuest: (guestId: string, month: Date) => void;
  onSelectAirBnBGuest: (alias: string, month: Date) => void;
}

const GuestSearch = ({ guests, monthMap, onSelectGuest, onSelectAirBnBGuest }: GuestSearchProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    // Regular guests
    const regularMap = new Map<string, SearchResult>();
    for (const guest of guests) {
      if (guest.name === "AirBnB") continue;
      const name = guest.alias || guest.name;
      if (!name.toLowerCase().includes(q)) continue;
      regularMap.set(guest.id, { type: "regular", id: guest.id, alias: name, roomName: "", latestDate: "" });
    }

    // AirBnB aliases
    const airbnbMap = new Map<string, SearchResult>();

    for (const [dateStr, day] of monthMap) {
      for (const booking of day.bookings) {
        if (!booking.startDate || booking.startDate !== dateStr) continue;

        if (booking.guest?.name !== "AirBnB" && booking.guest?.id) {
          const entry = regularMap.get(booking.guest.id);
          if (entry && booking.startDate > entry.latestDate) {
            entry.latestDate = booking.startDate;
            entry.roomName = booking.room?.name ?? "";
            entry.roomColor = booking.room?.color;
          }
        }

        if (
          booking.guest?.name === "AirBnB" &&
          !booking.airbnbBlocked &&
          booking.alias
        ) {
          if (!booking.alias.toLowerCase().includes(q)) continue;
          const existing = airbnbMap.get(booking.alias);
          if (!existing || booking.startDate > existing.latestDate) {
            airbnbMap.set(booking.alias, {
              type: "airbnb",
              alias: booking.alias,
              roomName: booking.room?.name ?? "",
              roomColor: booking.room?.color,
              latestDate: booking.startDate,
            });
          }
        }
      }
    }

    const all: SearchResult[] = [
      ...Array.from(regularMap.values()).filter((r) => r.latestDate),
      ...Array.from(airbnbMap.values()),
    ];
    return all.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [query, guests, monthMap]);

  const handleSelect = (result: SearchResult) => {
    const month = result.latestDate ? new Date(result.latestDate + "T12:00:00") : new Date();
    if (result.type === "regular" && result.id) {
      onSelectGuest(result.id, month);
    } else {
      onSelectAirBnBGuest(result.alias, month);
    }
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative px-2 py-1.5 border-b border-gray-100">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search guest…"
        className="w-full text-sm px-2.5 py-1 rounded-lg border border-gray-200 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 placeholder-gray-300"
      />
      {open && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(r)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-left border-b border-gray-50 last:border-0"
            >
              <span className={`${getRoomColor(r.roomName, r.roomColor)} text-white text-[10px] font-semibold px-1.5 py-px rounded shrink-0`}>
                {r.roomName || "—"}
              </span>
              <span className="flex-1 text-sm text-gray-800 truncate">{r.alias}</span>
              {r.type === "airbnb" && (
                <span className="text-[10px] font-bold text-rose-400 shrink-0">(A)</span>
              )}
              {r.latestDate && (
                <span className="text-xs text-gray-400 shrink-0">
                  {format(parseISO(r.latestDate), "MMM d")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GuestSearch;