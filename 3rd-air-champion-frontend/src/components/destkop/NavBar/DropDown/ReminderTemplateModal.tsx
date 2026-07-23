import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_TEMPLATE, TEMPLATE_KEY } from "../../../../util/reminderTemplate";

interface ReminderTemplateModalProps {
  onClose: () => void;
}

const PLACEHOLDERS = [
  { label: "Name", value: "{{name}}" },
  { label: "Duration", value: "{{duration}}" },
  { label: "Night Word", value: "{{nightWord}}" },
  { label: "Start Date", value: "{{startDate}}" },
  { label: "Itinerary (room-by-room)", value: "{{itinerary}}" },
  { label: "Room", value: "{{room}}" },
  { label: "Room Code", value: "{{roomCode}}" },
  { label: "Door Code", value: "{{doorCode}}" },
  { label: "AirBnB Name", value: "{{airBnBName}}" },
  { label: "AirBnB Address", value: "{{airBnBAddress}}" },
  { label: "House Rules", value: "{{houseRules}}" },
];

const ReminderTemplateModal = ({ onClose }: ReminderTemplateModalProps) => {
  const [draft, setDraft] = useState(
    () => localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const save = () => {
    localStorage.setItem(TEMPLATE_KEY, draft);
    onClose();
  };

  const insertPlaceholder = (placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = draft.slice(0, start) + placeholder + draft.slice(end);
    setDraft(newValue);

    // Restore focus and move cursor to after the inserted placeholder
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + placeholder.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-lg shadow-lg flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onClose}
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
          >
            &times;
          </button>
          <h2 className="font-bold text-lg">Reminder Template</h2>
        </div>

        <textarea
          ref={textareaRef}
          className="border rounded px-2 py-1 text-sm w-full min-h-[120px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => insertPlaceholder(value)}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs rounded font-mono"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDraft(DEFAULT_TEMPLATE)}
            className="px-3 py-1 bg-blue-400 text-white text-sm rounded"
          >
            Reset to Default
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-400 text-white text-sm rounded"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ReminderTemplateModal;