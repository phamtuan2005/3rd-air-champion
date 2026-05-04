import { useState } from "react";
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
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const profitNum = parseFloat(profit);
    if (isNaN(profitNum) || profitNum <= 0) return;
    onSave({ bookingId: booking.id, alias, numberOfGuests: Math.max(1, guests), profit: profitNum });
    setSaved(true);
  };

  const checkIn = (() => {
    try { return format(parseISO(booking.startDate), "MMM d"); } catch { return booking.startDate; }
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

      {/* Name field */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-14 shrink-0">Name</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Guest name"
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
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

      {/* Guests + Profit row */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-14 shrink-0">Guests</label>
        <select
          value={guests}
          onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-16 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
        >
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <label className="text-xs text-gray-500 ml-2 shrink-0">Profit</label>
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
        <button
          type="button"
          onClick={handleSave}
          disabled={!profit || parseFloat(profit) <= 0}
          className="px-3 py-1.5 bg-orange-400 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
        >
          Save
        </button>
      </div>
    </div>
  );
};

const MissingProfitModal = ({ bookings, onClose, onSave }: MissingProfitModalProps) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
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