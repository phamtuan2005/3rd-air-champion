import { useState } from "react";
import { createPortal } from "react-dom";
import { updateDoorCode, getHost } from "../../../../util/hostOperations";

interface DoorCodeModalProps {
  currentDoorCode: string;
  onClose: () => void;
  onSaved: (newDoorCode: string) => void;
}

const DoorCodeModal = ({ currentDoorCode, onClose, onSaved }: DoorCodeModalProps) => {
  const [draft, setDraft] = useState(currentDoorCode);
  const [error, setError] = useState("");

  const save = async () => {
    const token = localStorage.getItem("token");
    const hostId = getHost() as string;
    if (!token || !hostId) return;

    try {
      await updateDoorCode(hostId, draft, token);
      onSaved(draft);
      onClose();
    } catch {
      setError("Failed to save door code. Please try again.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-sm shadow-lg flex flex-col gap-3">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onClose}
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
          >
            &times;
          </button>
          <h2 className="font-bold text-lg">Door Code</h2>
        </div>

        <input
          type="text"
          className="border rounded px-2 py-1 text-sm w-full"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Enter door code"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2 justify-end">
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

export default DoorCodeModal;