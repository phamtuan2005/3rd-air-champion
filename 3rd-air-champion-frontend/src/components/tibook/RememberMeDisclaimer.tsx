import { useEffect, useRef } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { formatPhone } from "../../util/formatPhone";

interface RememberMeDisclaimerProps {
  // The number they just gave, shown back so they can see exactly what is being
  // asked about. "Your phone number" in the abstract is a policy; their own
  // number on the screen is a thing they can decide about.
  phone: string;
  onAllow: () => void;
  onDeny: () => void;
}

// Asked once, the first time a guest gives us their number, BEFORE it is
// written anywhere. Saying no does not cost them anything today — their stays
// and wish list are already loaded and stay loaded; the number just is not
// there waiting for them next time.
const RememberMeDisclaimer = ({ phone, onAllow, onDeny }: RememberMeDisclaimerProps) => {
  const { theme } = useTiBookTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const allowRef = useRef<HTMLButtonElement>(null);

  // There is deliberately no Escape handler and no backdrop dismiss. Every other
  // overlay in TiBook closes that way, so this is the odd one out on purpose:
  // dismissing a consent question would have to be read as one answer or the
  // other, and guessing which is exactly what this dialog exists to stop.
  // Both answers are buttons, and both are equally easy to press.
  useEffect(() => {
    // Where focus was before we interrupted, so it can be handed back. A guest
    // using a keyboard or a screen reader should land back on the phone field
    // or the Search button they came from, not at the top of the page.
    const returnTo = document.activeElement as HTMLElement | null;
    allowRef.current?.focus();

    // Tab is kept inside the dialog. Without this the focus ring walks off into
    // the sheet underneath, which is still rendered — the guest would be
    // tabbing through a form while a question they have not answered sits on
    // top of it.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>("button");
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnTo?.focus?.();
    };
  }, []);

  return (
    <div
      className="tibook-type fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remember-me-title"
    >
      <div ref={panelRef} className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className={`flex items-center gap-2 border-b ${theme.tagBorder} ${theme.tagBg} px-4 py-3`}>
          <span className="text-xl">🔒</span>
          <div>
            <p id="remember-me-title" className={`text-sm font-bold ${theme.tagText}`}>
              Save your number on this device?
            </p>
            <p className="text-[11px] text-gray-500">So you don't have to type it again</p>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <p className="text-xs leading-relaxed text-gray-600">
            If you say yes, we'll keep{" "}
            <span className="font-semibold text-gray-800">{formatPhone(phone)}</span> and your name
            in this browser's storage on your own phone or computer. Next time you open TiBook,
            your stays, your wish list and your rate are already here.
          </p>

          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-gray-600">
            <li className="flex gap-2">
              <span className={theme.textPrimary}>•</span>
              <span>It stays on this device — it isn't a tracking cookie and no one else can read it.</span>
            </li>
            <li className="flex gap-2">
              <span className={theme.textPrimary}>•</span>
              <span>
                Your booking request reaches the house either way — this is only about saving you
                the typing next visit.
              </span>
            </li>
            {/* This says exactly what the button does, because it did not once:
                "Not you?" cleared the number but kept the yes, so the next one
                was saved again without asking. It now clears the answer too. */}
            <li className="flex gap-2">
              <span className={theme.textPrimary}>•</span>
              <span>
                Change your mind whenever you like: "Not you?" in Your Bookings clears your number
                and this choice from this device, and we'll ask again next time.
              </span>
            </li>
          </ul>

          <button
            ref={allowRef}
            type="button"
            onClick={onAllow}
            className={`mt-4 w-full rounded-lg ${theme.btn} ${theme.btnHover} ${theme.btnActive} py-2.5 text-sm font-bold text-white`}
          >
            Yes, remember me
          </button>
          {/* Deliberately as easy to press as the yes. A refusal that takes more
              work than an agreement is not really a choice being offered. */}
          <button
            type="button"
            onClick={onDeny}
            className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            No, just for this visit
          </button>
        </div>
      </div>
    </div>
  );
};

export default RememberMeDisclaimer;
