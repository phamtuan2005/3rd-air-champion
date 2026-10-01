import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// The editor behind TiMag message templates: the reminder and the booking
// confirmation.
//
// Each had its own copy of one early design: the close button centred above
// the title, placeholder chips in a monospace face, and three bright buttons
// in a row, blue, grey and green. Anh-Tuan called it childish (2026-10-01).
// It is one component now so the two cannot drift apart again, drawn in the
// language the Staffing modal uses: a titled header, quiet section labels,
// one dark primary button.
//
// The preview is new. A template is a page of {{tokens}} until it is sent,
// and the host could not see the message a guest would read without sending
// one. It fills each token with a sample, so it says what will happen.
//
// A floating window, not a fixed dialog. The first redesign was a fixed-size
// panel, and a message can be long: Anh-Tuan asked for it to be sizeable, and
// to close when sized down to nothing (2026-10-01). It is the window the
// Clean modal already is: the bar at the top drags the height (bottom edge
// anchored, as on the ToDo sheet), the header moves it, there is no backdrop,
// and the message box takes whatever height the window is given. Released
// below CLOSE_H it closes, as the booking sheet does.

export interface TemplatePlaceholder {
  label: string;
  value: string; // the token, e.g. {{name}}
  sample: string; // what the preview shows in its place
}

interface TemplateEditorModalProps {
  title: string;
  subtitle: string;
  placeholders: TemplatePlaceholder[];
  initial: string;
  defaultTemplate: string;
  onSave: (template: string) => void;
  onClose: () => void;
}

// px. The bar can be dragged down to MIN_H; let go anywhere under CLOSE_H and
// the window closes. The gap between them is the room to change your mind.
const MIN_H = 150;
const CLOSE_H = 230;
const WIDTH = 512;

const TemplateEditorModal = ({
  title,
  subtitle,
  placeholders,
  initial,
  defaultTemplate,
  onSave,
  onClose,
}: TemplateEditorModalProps) => {
  const [draft, setDraft] = useState(initial);
  // Writing the message, or reading it as a guest would. See the switch below.
  const [view, setView] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [size, setSize] = useState(() => ({
    w: Math.min(WIDTH, window.innerWidth - 16),
    h: Math.min(Math.round(window.innerHeight * 0.85), 760),
  }));
  const [pos, setPos] = useState(() => ({
    x: Math.max(8, Math.round(window.innerWidth / 2 - Math.min(WIDTH, window.innerWidth - 16) / 2)),
    // Near the top: the message box takes focus on a phone, the keyboard
    // comes up, and a window lower down would sit half behind it.
    y: 40,
  }));
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{ pointerY: number; top: number; h: number } | null>(null);
  // The height as of the last move, read on release. State would do in most
  // renders, but the release must never act on a height one frame old.
  const lastH = useRef(size.h);

  const onDragStart = (e: React.PointerEvent) => {
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragOffset.current) return;
    setPos({
      x: Math.min(Math.max(4, e.clientX - dragOffset.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(4, e.clientY - dragOffset.current.dy), window.innerHeight - 80),
    });
  };
  const onDragEnd = () => {
    dragOffset.current = null;
  };

  // The bottom edge stays where it is; the top edge follows the pointer.
  const onBarStart = (e: React.PointerEvent) => {
    resizeStart.current = { pointerY: e.clientY, top: pos.y, h: size.h };
    lastH.current = size.h;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!resizeStart.current) return;
    const start = resizeStart.current;
    const bottom = start.top + start.h;
    const newH = Math.min(
      Math.max(MIN_H, start.h - (e.clientY - start.pointerY)),
      Math.min(window.innerHeight - 24, bottom - 4),
    );
    lastH.current = newH;
    setSize((s) => ({ ...s, h: newH }));
    setPos((p) => ({ ...p, y: bottom - newH }));
  };
  const onBarEnd = () => {
    if (!resizeStart.current) return;
    resizeStart.current = null;
    if (lastH.current < CLOSE_H) onClose();
  };

  const insertPlaceholder = (placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setDraft(draft.slice(0, start) + placeholder + draft.slice(end));
    // Restore focus and put the cursor after what was inserted.
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + placeholder.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  // Plain substitution, token by token. The real message has a few smarter
  // rules (one night reads "tomorrow night"), so this is labelled a sample.
  const preview = placeholders.reduce((text, p) => text.split(p.value).join(p.sample), draft).trim();
  const isDefault = draft === defaultTemplate;
  // Small enough that letting go will close it. The window fades and says so
  // before it happens.
  const closing = size.h < CLOSE_H;

  const label = "text-xs font-semibold uppercase tracking-wide text-gray-400";

  return createPortal(
    <div
      className={`modal-type fixed z-[110] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-opacity ${
        closing ? "opacity-50" : ""
      }`}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Handle bar: drag up for a taller window, down for a shorter one. */}
      <div
        className="flex shrink-0 cursor-row-resize touch-none select-none flex-col items-center gap-1 pb-1 pt-2"
        onPointerDown={onBarStart}
        onPointerMove={onBarMove}
        onPointerUp={onBarEnd}
        onPointerCancel={onBarEnd}
      >
        <div className="h-1 w-10 rounded-full bg-gray-300" />
        {closing && <span className="text-[11px] font-semibold text-gray-500">Let go to close</span>}
      </div>

      {/* The header doubles as the move handle. */}
      <div
        className="flex shrink-0 cursor-move touch-none select-none items-start justify-between gap-2 border-b border-gray-100 px-4 pb-3 pt-1"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          // Its own press, not the start of a drag.
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Close"
          className="shrink-0 px-1 text-xl leading-none text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {/* Edit or Preview, one at a time, so each has the whole window.
            Both were on screen at first: the box, then the chips, then the
            preview. Measured in a browser at three window heights, the chips
            and the preview took the room and the box stayed about 115px tall
            however far the window was dragged — no use for a long message,
            which is why the window is sizeable at all. The same segmented
            switch as the Staffing tabs. */}
        <div className="flex shrink-0 gap-1 rounded-xl bg-gray-100 p-1">
          {(["edit", "preview"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
                view === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {k === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>

        {view === "edit" ? (
          <>
        {/* flex-1 hands the box every pixel the window is dragged taller;
            the floor keeps a few lines when the window is short and the
            body scrolls instead. */}
        <div className="flex min-h-[7rem] flex-1 flex-col">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-0 w-full flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 focus:border-gray-400 focus:outline-none"
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <span className={label}>Insert at the cursor</span>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map(({ label: name, value }) => {
              const used = draft.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  title={value}
                  onClick={() => insertPlaceholder(value)}
                  // Filled once the message uses it, so a glance says what
                  // the message already carries and what it leaves out.
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    used
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
          </>
        ) : (
          <div className="flex min-h-[7rem] flex-1 flex-col gap-1.5">
            <span className={label}>As a guest reads it, with sample details</span>
            <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700">
              {preview || <span className="text-gray-400">The message is empty.</span>}
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
        {/* Quiet, and on the far side from Save: it replaces everything typed
            above. Nothing is stored until Save. */}
        <button
          type="button"
          onClick={() => setDraft(defaultTemplate)}
          disabled={isDefault}
          className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          Reset to default
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Save
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default TemplateEditorModal;
