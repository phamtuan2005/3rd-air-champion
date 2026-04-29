import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { setGuestWishList } from "../../util/wishListOperations";
import { fetchGuestByPhone } from "../../util/guestOperations";

interface WishListSummarySheetProps {
  hostId: string;
  wishListDates: Set<string>;
  guestPhone: string;
  guestName: string;
  onClose: () => void;
  onToggleDate: (date: string) => void;
  onSendSuccess: (phone: string, name: string, newDates: string[]) => void;
}

const fmtDate = (d: string) => format(parseISO(d), "EEE, MMM d yyyy");

const WishListSummarySheet = ({
  hostId,
  wishListDates,
  guestPhone,
  guestName,
  onClose,
  onToggleDate,
  onSendSuccess,
}: WishListSummarySheetProps) => {
  const { theme } = useTiBookTheme();
  const sortedDates = [...wishListDates].sort();

  const [phone, setPhone] = useState(guestPhone);
  const [name, setName] = useState(guestName);
  const [lookingUp, setLookingUp] = useState(false);
  const [foundGuest, setFoundGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsIdentity = !guestPhone;

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setFoundGuest(false);
    const digits = val.replace(/\D/g, "");
    if (digits.length < 10) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookingUp(true);
      const guest = await fetchGuestByPhone(val.trim(), hostId);
      setLookingUp(false);
      if (guest) { setName(guest.name); setFoundGuest(true); }
    }, 500);
  };

  const handleSend = async () => {
    if (!phone.trim() || !name.trim()) { setError("Please enter your phone number and name."); return; }
    if (sortedDates.length === 0) { setError("No dates selected."); return; }
    setError("");
    setLoading(true);
    try {
      const result = await setGuestWishList({ host: hostId, guestPhone: phone.trim(), guestName: name.trim(), dates: sortedDates });
      setSent(true);
      setTimeout(() => onSendSuccess(phone.trim(), name.trim(), result.dates), 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h2 className={`font-bold text-base ${theme.textPrimaryDark}`}>
            My Wish List — {wishListDates.size} date{wishListDates.size !== 1 ? "s" : ""}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {/* Date list */}
          {sortedDates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No dates saved yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedDates.map((d) => (
                <div key={d} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${theme.tagBg} ${theme.tagBorder}`}>
                  <span className={`text-sm font-semibold ${theme.textPrimaryDark}`}>{fmtDate(d)}</span>
                  <button
                    type="button"
                    onClick={() => onToggleDate(d)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Identity form — only when no saved phone */}
          {needsIdentity && sortedDates.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="relative">
                <input
                  type="tel"
                  placeholder="Your phone number"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ${theme.focusRing}`}
                />
                {lookingUp && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">looking up...</span>}
                {foundGuest && !lookingUp && <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${theme.textPrimary}`}>✓ found</span>}
              </div>
              {foundGuest ? (
                <div className={`${theme.tagBg} ${theme.tagBorder} border rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                  <span className={`text-sm font-semibold ${theme.textPrimaryDark}`}>{name}</span>
                  <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setFoundGuest(false); setName(""); }}>edit</button>
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
        </div>

        {/* Footer */}
        {sortedDates.length > 0 && (
          <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              disabled={loading || sent}
              onClick={handleSend}
              className={`w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${
                sent ? "bg-green-500" : `${theme.btn} ${theme.btnHover}`
              }`}
            >
              {sent ? "Sent ✓" : loading ? "Sending..." : "Send to host →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishListSummarySheet;