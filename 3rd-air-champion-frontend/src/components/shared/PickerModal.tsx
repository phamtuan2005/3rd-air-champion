import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FaCheck } from "react-icons/fa";

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  Icon?: React.ComponentType<{ size?: number; className?: string }>;
  // Drawn instead of the icon circle when the row has a richer identity than an
  // icon can carry — a guest avatar, say. Icon stays for everything else.
  node?: React.ReactNode;
  // Whole class strings, never interpolated fragments — Tailwind only ships
  // classes it can literally see.
  accent?: string; // e.g. "bg-teal-600"
  rowActive?: string; // e.g. "bg-teal-50 text-teal-800"
}

interface PickerModalProps<T extends string | number> {
  open: boolean;
  title: string;
  subtitle?: string;
  options: PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  onClose: () => void;
}

// A centred choice modal for the calendar header controls.
//
// These began as native <select>s, then as anchored popovers. Both failed on a
// phone: the OS wheel looks nothing like TiMag, and a panel anchored to a
// crowded header is permanently fighting the screen edge — it was clipped to one
// row, then cut off on the left. Centring sidesteps the whole class of problem,
// and gives room for a line explaining what each choice actually does.
const PickerModal = <T extends string | number>({
  open,
  title,
  subtitle,
  options,
  value,
  onChange,
  onClose,
}: PickerModalProps<T>) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    // z above the mobile panels and the hold bar, which sit in the 60–300 range.
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"
        // The backdrop closes; the card must not close when tapped through.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-b-0 ${
                  selected ? o.rowActive ?? "bg-gray-50 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {o.node ? (
                  <span className="shrink-0">{o.node}</span>
                ) : o.Icon ? (
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                      o.accent ?? "bg-gray-400"
                    }`}
                  >
                    <o.Icon size={14} />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-tight">{o.label}</span>
                  {o.hint && (
                    <span className="block text-[11px] leading-tight text-gray-500">{o.hint}</span>
                  )}
                </span>
                {selected && <FaCheck size={12} className="shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PickerModal;
