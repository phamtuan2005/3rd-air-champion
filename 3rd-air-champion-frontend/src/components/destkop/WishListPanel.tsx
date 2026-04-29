import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { getHostWishLists, WishListEntry } from "../../util/wishListOperations";

interface WishListPanelProps {
  hostId: string;
  token: string;
}

const WishListPanel = ({ hostId, token }: WishListPanelProps) => {
  const [entries, setEntries] = useState<WishListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHostWishLists(hostId, token)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [hostId, token]);

  const activeEntries = entries.filter((e) => e.dates.length > 0);

  if (loading) {
    return <p className="text-sm text-gray-500 text-center py-8">Loading...</p>;
  }

  if (activeEntries.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No wish list entries yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activeEntries.map((entry) => {
        const sortedDates = [...entry.dates].sort();
        return (
          <div
            key={entry.id}
            className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gray-800">{entry.guestName}</span>
              <span className="text-[11px] text-gray-400">{entry.guestPhone}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sortedDates.map((d) => (
                <span
                  key={d}
                  className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                >
                  {format(parseISO(d), "EEE MMM d")}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-gray-300">
              Added {format(new Date(Number(entry.createdAt)), "MMM d, yyyy")}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default WishListPanel;