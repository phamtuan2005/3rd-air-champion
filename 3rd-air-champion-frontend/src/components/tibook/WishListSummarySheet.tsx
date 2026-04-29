import { format, parseISO } from "date-fns";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

interface WishListSummarySheetProps {
  wishListDates: Set<string>;
  guestPhone: string;
  guestName: string;
  onClose: () => void;
  onDateClick: (date: string) => void;
}

const fmtDate = (d: string) =>
  format(parseISO(d), "EEE, MMM d yyyy");

const WishListSummarySheet = ({
  wishListDates,
  guestPhone,
  guestName,
  onClose,
  onDateClick,
}: WishListSummarySheetProps) => {
  const { theme } = useTiBookTheme();
  const sortedDates = [...wishListDates].sort();
  const hostPhone = import.meta.env.VITE_TI_BOOK_HOST_PHONE as string | undefined;

  const smsBody = encodeURIComponent(
    `Hi! My name is ${guestName || "a guest"} and I'd love to book on these dates: ${sortedDates.map(fmtDate).join(", ")}. Could you let me know when any become available? My phone: ${guestPhone}. Thank you!`,
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h2 className={`font-bold text-base ${theme.textPrimaryDark}`}>
            My Wish List — {wishListDates.size} date{wishListDates.size !== 1 ? "s" : ""}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        {/* Date list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2">
          {sortedDates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No dates saved yet.</p>
          ) : (
            sortedDates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { onClose(); onDateClick(d); }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${theme.tagBg} ${theme.tagBorder} hover:opacity-80 transition-opacity text-left w-full`}
              >
                <span className={`text-sm font-semibold ${theme.textPrimaryDark}`}>{fmtDate(d)}</span>
                <span className="text-xs text-gray-400">tap to remove ×</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex flex-col gap-2 flex-shrink-0">
          {hostPhone && (
            <a
              href={`sms:${hostPhone}?body=${smsBody}`}
              className={`w-full py-3 rounded-xl text-white text-sm font-semibold text-center ${theme.btn} ${theme.btnHover} transition-colors`}
            >
              Send now →
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WishListSummarySheet;