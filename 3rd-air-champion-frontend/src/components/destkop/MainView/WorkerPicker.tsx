import { useState } from "react";
import { createPortal } from "react-dom";
import { FaUser } from "react-icons/fa";

// Who the Staffing tab is about: everyone, or one worker, found by typing.
//
// The Hours tab first offered one chip per worker in a sideways row. Four
// chips read fine; Anh-Tuan asked what a hundred would look like
// (2026-09-30), and the answer was a wall nobody could swipe through. A list
// behind a search box is the same control at any size — the pattern the
// calendar's Filter dropdown already uses for eighty guests.
//
// Shared by Hours and Payroll so a worker is picked the same way in both.

export interface PickablePerson {
  id: string;
  name: string;
  // A word under the name: their title, or "cleaner".
  hint?: string;
  // Something waiting on the host for this person — claims to approve.
  badge?: number;
  // Their face, the same one the Team tab shows, so a name is recognised
  // before it is read.
  avatar?: React.ReactNode;
}

interface WorkerPickerProps {
  title: string;
  people: PickablePerson[];
  value: string | null;
  onChange: (id: string | null) => void;
}

const WorkerPicker = ({ title, people, value, onChange }: WorkerPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const picked = people.find((p) => p.id === value) ?? null;
  const q = query.trim().toLowerCase();
  // Names with something waiting come first: that is who the host opened the
  // tab for. Then the rest by name.
  const shown = [...people]
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.hint ?? "").toLowerCase().includes(q))
    .sort((a, b) => (b.badge ?? 0) - (a.badge ?? 0) || a.name.localeCompare(b.name));
  const waiting = people.reduce((n, p) => n + (p.badge ?? 0), 0);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const row = (key: string, checked: boolean, onPick: () => void, body: React.ReactNode) => (
    <li
      key={key}
      className="flex list-none cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50"
      onClick={() => {
        onPick();
        close();
      }}
    >
      <input type="radio" readOnly checked={checked} className="pointer-events-none h-4 w-4 shrink-0" />
      {body}
    </li>
  );

  const panel = open
    ? createPortal(
        // Anchored to the top, not centred, for the same reason as the
        // calendar's Filter: the search box autofocuses, a phone's keyboard
        // is up at once, and a centred panel slides its top edge down behind
        // it as the list filters. dvh, never vh ([[project-mobile-dvh-calendar]]).
        <div
          className="modal-type fixed inset-0 z-[300] flex items-start justify-center bg-black bg-opacity-40 pt-[8dvh]"
          onClick={close}
        >
          <div className="flex max-h-[78dvh] w-80 flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
              <button type="button" className="px-1 text-xl leading-none text-gray-400 hover:text-gray-600" onClick={close}>
                &times;
              </button>
            </div>
            <div className="px-4 pt-3">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name…"
                className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {!q &&
                row("everyone", value === null, () => onChange(null), (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="italic text-gray-500">Everyone</span>
                    {waiting > 0 && (
                      <span className="ml-auto rounded-full bg-amber-200 px-1.5 py-0.5 text-[11px] font-bold leading-none text-amber-800">
                        {waiting}
                      </span>
                    )}
                  </span>
                ))}
              {shown.map((p) =>
                row(p.id, value === p.id, () => onChange(p.id), (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {p.avatar}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-800">{p.name}</span>
                      {p.hint && <span className="block text-[11px] text-gray-400">{p.hint}</span>}
                    </span>
                    {(p.badge ?? 0) > 0 && (
                      <span className="ml-auto rounded-full bg-amber-200 px-1.5 py-0.5 text-[11px] font-bold leading-none text-amber-800">
                        {p.badge}
                      </span>
                    )}
                  </span>
                )),
              )}
              {shown.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Nobody by that name.</p>}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-[17rem] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-left"
      >
        {picked ? (
          <span className="flex min-w-0 items-center gap-2 text-base font-bold text-emerald-700">
            {picked.avatar ?? <FaUser size={13} className="shrink-0" />}
            <span className="truncate">{picked.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-sm italic text-gray-500">
            Everyone
            {waiting > 0 && (
              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[11px] font-bold not-italic leading-none text-amber-800">
                {waiting}
              </span>
            )}
          </span>
        )}
        <span className="shrink-0 text-xs text-gray-400">▾</span>
      </button>
      {panel}
    </>
  );
};

export default WorkerPicker;
