import { useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_TEMPLATE, TEMPLATE_KEY } from "./ReminderTemplateButton";

interface ReminderTemplateModalProps {
  onClose: () => void;
}

const ReminderTemplateModal = ({ onClose }: ReminderTemplateModalProps) => {
  const [draft, setDraft] = useState(
    () => localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE,
  );

  const save = () => {
    localStorage.setItem(TEMPLATE_KEY, draft);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-lg shadow-lg flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">Reminder Template</h2>
          <button
            onClick={onClose}
            className="text-gray-700 font-bold text-[1.5rem] leading-none"
          >
            &times;
          </button>
        </div>

        <textarea
          className="border rounded px-2 py-1 text-sm w-full min-h-[120px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <p className="text-xs text-gray-500">
          Available placeholders:{" "}
          <code>{"{{name}}"}</code>,{" "}
          <code>{"{{duration}}"}</code>,{" "}
          <code>{"{{nightWord}}"}</code>,{" "}
          <code>{"{{startDate}}"}</code>,{" "}
          <code>{"{{room}}"}</code>,{" "}
          <code>{"{{roomCode}}"}</code>,{" "}
          <code>{"{{doorCode}}"}</code>
        </p>

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
