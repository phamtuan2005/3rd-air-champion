import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { toggleWishListDate } from "../../util/wishListOperations";
import { fetchGuestByPhone } from "../../util/guestOperations";

interface WishListModalProps {
  hostId: string;
  date: string; // YYYY-MM-DD
  isWishlisted: boolean;
  savedPhone: string;
  savedName: string;
  onClose: () => void;
  onSuccess: (phone: string, name: string, newDates: string[]) => void;
}

const WishListModal = ({
  hostId,
  date,
  isWishlisted,
  savedPhone,
  savedName,
  onClose,
  onSuccess,
}: WishListModalProps) => {
  const { theme } = useTiBookTheme();
  const [phone, setPhone] = useState(savedPhone);
  const [name, setName] = useState(savedName);
  const [lookingUp, setLookingUp] = useState(false);
  const [foundGuest, setFoundGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsIdentity = !savedPhone;
  const formattedDate = format(parseISO(date), "EEE, MMM d yyyy");

  useEffect(() => {
    if (!needsIdentity) return;
    setFoundGuest(false);

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookingUp(true);
      const guest = await fetchGuestByPhone(phone.trim(), hostId);
      setLookingUp(false);
      if (guest) {
        setName(guest.name);
        setFoundGuest(true);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!phone.trim() || !name.trim()) {
      setError("Please enter your phone number and name.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await toggleWishListDate({
        host: hostId,
        guestPhone: phone.trim(),
        guestName: name.trim(),
        date,
      });
      onSuccess(phone.trim(), name.trim(), result.dates);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className={`font-bold text-base ${theme.textPrimaryDark}`}>
            {isWishlisted ? "Remove from Wish List" : "Add to Wish List"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className={`${theme.tagBg} ${theme.tagBorder} border rounded-xl px-4 py-2.5`}>
          <p className="text-sm font-semibold text-gray-700">{formattedDate}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isWishlisted
              ? "This date is on your wish list. Tap below to remove it."
              : "Sold out for now — we'll keep this date saved for you."}
          </p>
        </div>

        {needsIdentity && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                type="tel"
                placeholder="Your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${theme.focusRing}`}
                autoFocus
              />
              {lookingUp && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  looking up...
                </span>
              )}
              {foundGuest && !lookingUp && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${theme.textPrimary}`}>
                  ✓ found
                </span>
              )}
            </div>
            {foundGuest ? (
              <div className={`${theme.tagBg} ${theme.tagBorder} border rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                <span className={`text-sm font-semibold ${theme.textPrimaryDark}`}>{name}</span>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => { setFoundGuest(false); setName(""); }}
                >
                  edit
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${theme.focusRing}`}
              />
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          disabled={loading}
          onClick={handleSubmit}
          className={`w-full py-3 rounded-xl text-white text-sm font-semibold ${
            isWishlisted ? "bg-red-400 hover:bg-red-500" : `${theme.btn} ${theme.btnHover}`
          } disabled:opacity-50 transition-colors`}
        >
          {loading
            ? "..."
            : isWishlisted
            ? "Remove from Wish List"
            : "Save to Wish List"}
        </button>
      </div>
    </div>
  );
};

export default WishListModal;