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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const label = "text-xs font-semibold uppercase tracking-wide text-gray-400";

  return createPortal(
    // Anchored near the top, not centred: the box takes focus on a phone, the
    // keyboard comes up, and a centred panel is pushed half behind it. dvh,
    // never vh ([[project-mobile-dvh-calendar]]). No close on a backdrop tap:
    // a stray tap would throw away an edited message.
    <div className="modal-type fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[6dvh]">
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 px-1 text-xl leading-none text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <span className={label}>Message</span>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={7}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 focus:border-gray-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
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

          <div className="flex flex-col gap-1.5">
            <span className={label}>Preview, with sample details</span>
            <p className="whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700">
              {preview || <span className="text-gray-400">The message is empty.</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
          {/* Quiet, and on the far side from Save: it replaces everything
              typed above. Nothing is stored until Save. */}
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
      </div>
    </div>,
    document.body,
  );
};

export default TemplateEditorModal;
