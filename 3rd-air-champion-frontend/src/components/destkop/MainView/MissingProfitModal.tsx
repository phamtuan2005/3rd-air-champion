import { useState } from "react";
import { parseReservation } from "../../../util/airbnbReservation";
import { format, parseISO } from "date-fns";
import { getRoomColor } from "../../../util/getRoomColor";

export interface MissingProfitBooking {
  id: string;
  alias: string;
  roomName: string;
  roomColor?: string;
  startDate: string;
  duration: number;
  description: string;
  numberOfGuests: number;
}

export interface MissingProfitSaveData {
  bookingId: string;
  alias: string;
  numberOfGuests: number;
  profit: number;
}

interface MissingProfitModalProps {
  bookings: MissingProfitBooking[];
  onClose: () => void;
  onSave: (data: MissingProfitSaveData) => void;
}

const extractAirbnbUrl = (description: string): string | null => {
  const match = description?.match(/https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/\S+/);
  return match ? match[0] : null;
};

const Row = ({
  booking,
  onSave,
}: {
  booking: MissingProfitBooking;
  onSave: (data: MissingProfitSaveData) => void;
}) => {
  const [alias, setAlias] = useState(booking.alias);
  const [guests, setGuests] = useState(booking.numberOfGuests || 1);
  const [profit, setProfit] = useState("");
  // What a pasted reservation page turned out to say, reported back rather than
  // three fields changing under the host's hands.
  const [pasteNote, setPasteNote] = useState<string | null>(null);

  // The AirBnB page, pasted whole.
  //
  // This modal exists because the payout is missing, and the host is looking at
  // the reservation page to find it. Retyping the three things it already says
  // is the work — and the guest count is the one that gets left wrong, because
  // the attention is on the name and the money.
  //
  // The page cannot be fetched from its link: host login, no CORS, DataDome.
  // Copying it is the one gesture available on a page already open.
  const takePastedPage = (text: string): boolean => {
    const r = parseReservation(text);
    if (!r || !r.alias) return false;
    const took: string[] = [];
    setAlias(r.alias);
    took.push(r.alias);
    if (r.guests) {
      setGuests(Math.min(Math.max(r.guests, 1), 4));
      took.push(`${r.guests} guest${r.guests === 1 ? "" : "s"}`);
    }
    if (r.payout != null) {
      // To the cent. The cents ARE the payout.
      setProfit(String(r.payout));
      took.push(`$${r.payout.toFixed(2)}`);
    }
    setPasteNote(took.length ? `Read ${took.join(" · ")}` : null);
    return true;
  };
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const profitNum = parseFloat(profit);
    if (isNaN(profitNum) || profitNum <= 0) return;
    onSave({ bookingId: booking.id, alias, numberOfGuests: Math.max(1, guests), profit: profitNum });
    setSaved(true);
  };

  const checkIn = (() => {
    // Same UTC-midnight trap as the month filter: parseISO on the full
    // timestamp lands the evening before in local time, so a Sept 1 check-in
    // was labelled "Aug 31". Parse the date part alone.
    try { return format(parseISO(booking.startDate.split("T")[0]), "MMM d"); } catch { return booking.startDate; }
  })();

  const airbnbUrl = extractAirbnbUrl(booking.description);

  if (saved) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 bg-green-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`${getRoomColor(booking.roomName, booking.roomColor)} text-white text-[10px] font-semibold px-1.5 py-px rounded shrink-0`}>{booking.roomName}</span>
            <p className="text-sm font-semibold text-green-700 truncate">{alias || "No name"}</p>
          </div>
          <p className="text-xs text-gray-400">{checkIn} · {booking.duration}n · {guests} guest{guests > 1 ? "s" : ""}</p>
        </div>
        <span className="text-sm font-bold text-green-600">${parseFloat(profit).toFixed(0)} ✓</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-0 bg-white space-y-2">
      {/* Room + date header */}
      <div className="flex items-center gap-1.5">
        <span className={`${getRoomColor(booking.roomName, booking.roomColor)} text-white text-[10px] font-semibold px-1.5 py-px rounded shrink-0`}>{booking.roomName}</span>
        <p className="text-xs text-gray-400">{checkIn} · {booking.duration}n</p>
      </div>

      {/* Paste the page instead of retyping it. Sits ABOVE the fields it
          fills, because reading it after they are typed is reading it too
          late. */}
      <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-2">
        <label htmlFor="airbnb-paste" className="text-xs font-semibold text-rose-900">
          Paste from AirBnB
        </label>
        <textarea
          id="airbnb-paste"
          rows={2}
          placeholder="Open the reservation, select all, paste here"
          onChange={(e) => {
            if (takePastedPage(e.target.value)) e.target.value = "";
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (takePastedPage(text)) {
              // Swallowed once it has been read: the box is a chute, not a
              // field, and leaving a page of text sitting in it invites the
              // host to wonder whether it saved.
              e.preventDefault();
              (e.target as HTMLTextAreaElement).value = "";
            }
          }}
          className="mt-1 w-full resize-none rounded border border-rose-200 px-2 py-1 text-xs focus:border-rose-400 focus:outline-none"
        />
        {pasteNote && (
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">{pasteNote}</p>
        )}
      </div>

      {/* Name field */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-14 shrink-0">Name</label>
        <div className="flex items-center gap-2 flex-1">
          {/* A name, not a paragraph — it had the whole row and dwarfed the one
              field this modal exists to collect. */}
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Guest name"
            className="w-40 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          />
          {airbnbUrl && (
            <a
              href={airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-rose-500 hover:text-rose-700 underline underline-offset-2 whitespace-nowrap"
            >
              AirBnB ↗
            </a>
          )}
        </div>
      </div>

      {/* Guests + Profit row. Guests is one digit and takes a digit's width; the
          profit field takes everything Save and the oversized picker were using,
          because the missing payout is the whole reason this modal is open. */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-14 shrink-0">Guests</label>
        <select
          value={guests}
          onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
          className="w-14 shrink-0 border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
        >
          {[1,2,3,4].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <label className="text-xs text-gray-500 ml-1 shrink-0">Profit</label>
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={profit}
            onChange={(e) => setProfit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 w-full text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          />
        </div>
      </div>

      {/* Save on its own line — sharing the row with Profit made it a narrow
          pill wedged against the field, and it is the commit for the whole row. */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!profit || parseFloat(profit) <= 0}
        className="w-full px-3 py-2 bg-orange-400 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Save
      </button>
    </div>
  );
};

const MissingProfitModal = ({ bookings, onClose, onSave }: MissingProfitModalProps) => {
  return (
    <div
      className="modal-type fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="bg-orange-400 text-white rounded-full px-2 py-0.5 text-xs font-bold leading-none">
              {bookings.length}
            </span>
            <h2 className="text-sm font-bold text-gray-800">AirBnB bookings missing profit</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Booking rows */}
        <div className="overflow-y-auto max-h-[65vh]">
          {bookings.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">All profits entered!</p>
          ) : (
            bookings.map((b) => (
              <Row key={`${b.startDate}_${b.id}`} booking={b} onSave={onSave} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MissingProfitModal;