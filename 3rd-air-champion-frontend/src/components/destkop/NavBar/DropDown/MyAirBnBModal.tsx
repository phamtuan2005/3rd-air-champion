import { useState } from "react";
import { createPortal } from "react-dom";
import { updateAirBnBInfo, getHost } from "../../../../util/hostOperations";

interface MyAirBnBInfo {
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  houseRules: string;
}

interface MyAirBnBModalProps {
  current: MyAirBnBInfo;
  onClose: () => void;
  onSaved: (info: MyAirBnBInfo) => void;
}

const MyAirBnBModal = ({ current, onClose, onSaved }: MyAirBnBModalProps) => {
  const [draft, setDraft] = useState<MyAirBnBInfo>({ ...current });
  const [error, setError] = useState("");

  const save = async () => {
    const token = localStorage.getItem("token");
    const hostId = getHost() as string;
    if (!token || !hostId) return;

    try {
      await updateAirBnBInfo(hostId, draft, token);
      onSaved(draft);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    }
  };

  const field = (
    label: string,
    key: keyof MyAirBnBInfo,
    multiline?: boolean
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {multiline ? (
        <textarea
          className="border rounded px-2 py-1 text-sm w-full resize-none"
          rows={4}
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      ) : (
        <input
          type="text"
          className="border rounded px-2 py-1 text-sm w-full"
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-4 w-full max-w-sm shadow-lg flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onClose}
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
          >
            &times;
          </button>
          <h2 className="font-bold text-lg">My AirBnB</h2>
        </div>

        {field("AirBnB Name", "airbnbName")}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">AirBnB Address</label>
          <input
            type="text"
            placeholder="Street address"
            className="border rounded px-2 py-1 text-sm w-full"
            value={draft.airbnbAddress.split("\n")[0] ?? ""}
            onChange={(e) => {
              const line2 = draft.airbnbAddress.split("\n")[1] ?? "";
              setDraft((d) => ({ ...d, airbnbAddress: `${e.target.value}\n${line2}` }));
            }}
          />
          <input
            type="text"
            placeholder="City, State ZIP"
            className="border rounded px-2 py-1 text-sm w-full"
            value={draft.airbnbAddress.split("\n")[1] ?? ""}
            onChange={(e) => {
              const line1 = draft.airbnbAddress.split("\n")[0] ?? "";
              setDraft((d) => ({ ...d, airbnbAddress: `${line1}\n${e.target.value}` }));
            }}
          />
        </div>
        {field("Door Code", "doorCode")}
        {field("House Rules", "houseRules", true)}

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
    document.body
  );
};

export default MyAirBnBModal;