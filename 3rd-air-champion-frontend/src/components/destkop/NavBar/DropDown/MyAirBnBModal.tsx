import { useState } from "react";
import { createPortal } from "react-dom";
import { updateAirBnBInfo, getHost } from "../../../../util/hostOperations";

interface MyAirBnBInfo {
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  airbnbRating: number | "";
  airbnbReviewCount: number | "";
  airbnbSuperhost: boolean;
  highlights: string;
  houseRules: string;
  phone: string;
  contactEmail: string;
  licenseNumber: string;
}

interface MyAirBnBModalProps {
  current: MyAirBnBInfo;
  onClose: () => void;
  onSaved: (info: MyAirBnBInfo) => void;
}

type Tab = "public" | "property" | "contact";

const TABS: { id: Tab; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "property", label: "Property" },
  { id: "contact", label: "Contact" },
];

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

const inputCls = "border border-gray-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition";

const MyAirBnBModal = ({ current, onClose, onSaved }: MyAirBnBModalProps) => {
  const [draft, setDraft] = useState<MyAirBnBInfo>({ ...current });
  const [tab, setTab] = useState<Tab>("public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof MyAirBnBInfo>(key: K, value: MyAirBnBInfo[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const token = localStorage.getItem("token");
    const hostId = getHost() as string;
    if (!token || !hostId) return;
    setSaving(true);
    setError("");
    try {
      await updateAirBnBInfo(
        hostId,
        {
          ...draft,
          airbnbRating: draft.airbnbRating === "" ? undefined : draft.airbnbRating,
          airbnbReviewCount: draft.airbnbReviewCount === "" ? undefined : draft.airbnbReviewCount,
          highlights: draft.highlights
            ? draft.highlights.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
        },
        token
      );
      onSaved(draft);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-base">My AirBnB</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage your listing details</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                tab === id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5 flex flex-col gap-4 min-h-[240px]">
          {tab === "public" && (
            <>
              <Field label="Listing Name">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. TT House · Old Quarter"
                  value={draft.airbnbName}
                  onChange={(e) => set("airbnbName", e.target.value)}
                />
              </Field>

              <div className="flex gap-3">
                <Field label="Rating">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="5"
                    placeholder="4.96"
                    className={inputCls}
                    value={draft.airbnbRating}
                    onChange={(e) =>
                      set("airbnbRating", e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                  />
                </Field>
                <Field label="Reviews">
                  <input
                    type="number"
                    min="0"
                    placeholder="300"
                    className={inputCls}
                    value={draft.airbnbReviewCount}
                    onChange={(e) =>
                      set("airbnbReviewCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))
                    }
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Superhost</p>
                  <p className="text-xs text-gray-400">Shown as a badge on TiBook</p>
                </div>
                <button
                  type="button"
                  onClick={() => set("airbnbSuperhost", !draft.airbnbSuperhost)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    draft.airbnbSuperhost ? "bg-rose-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      draft.airbnbSuperhost ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <Field label="Highlights" hint="Comma-separated · shown as chips on TiBook">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="City View, Boutique Design, Old Quarter"
                  value={draft.highlights}
                  onChange={(e) => set("highlights", e.target.value)}
                />
              </Field>
            </>
          )}

          {tab === "property" && (
            <>
              <Field label="Address">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Street address"
                  value={draft.airbnbAddress.split("\n")[0] ?? ""}
                  onChange={(e) => {
                    const line2 = draft.airbnbAddress.split("\n")[1] ?? "";
                    set("airbnbAddress", `${e.target.value}\n${line2}`);
                  }}
                />
                <input
                  type="text"
                  className={inputCls}
                  placeholder="City, District"
                  value={draft.airbnbAddress.split("\n")[1] ?? ""}
                  onChange={(e) => {
                    const line1 = draft.airbnbAddress.split("\n")[0] ?? "";
                    set("airbnbAddress", `${line1}\n${e.target.value}`);
                  }}
                />
              </Field>

              <Field label="Door Code">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 1234#"
                  value={draft.doorCode}
                  onChange={(e) => set("doorCode", e.target.value)}
                />
              </Field>

              <Field label="House Rules">
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={5}
                  placeholder="No smoking, quiet after 10pm…"
                  value={draft.houseRules}
                  onChange={(e) => set("houseRules", e.target.value)}
                />
              </Field>
            </>
          )}

          {tab === "contact" && (
            <>
              <Field label="Phone">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="+84 xxx xxx xxx"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>

              <Field label="Contact Email">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="you@example.com"
                  value={draft.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                />
              </Field>

              <Field label="STR License Number">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="License #"
                  value={draft.licenseNumber}
                  onChange={(e) => set("licenseNumber", e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex flex-col gap-2">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MyAirBnBModal;