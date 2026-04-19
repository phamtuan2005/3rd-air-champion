import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { roomType } from "../../../../util/types/roomType";
import { updateSync } from "../../../../util/hostOperations";

const COLOR_OPTIONS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-gray-500",
];

const editRoomSchema = z.object({
  name: z
    .string()
    .min(3, "Must be at least 3 characters long")
    .regex(/^[^!@#$%^&*()_+=[\]{};:"\\|,<>/?~]+$/, {
      message: "Name cannot contain a special character",
    }),
  price: z.number().min(0, "Price cannot be negative"),
  roomCode: z.string(),
  active: z.boolean(),
});

type EditRoomFormData = z.infer<typeof editRoomSchema>;

interface EditRoomModalProps {
  rooms: roomType[];
  defaultRoomId?: string;
  onClose: () => void;
  onSave: (room: roomType, onError: (msg: string) => void) => void;
  onAdd: (room: { name: string; price: number; roomCode?: string; color?: string }, onError: (msg: string) => void) => void;
  onDelete: (roomId: string, onError: (msg: string) => void) => void;
  airbnbsync?: { room: string; link: string }[];
  hostId: string;
  token: string;
}

const EditRoomModal = ({ rooms, defaultRoomId, onClose, onSave, onAdd, onDelete, airbnbsync, hostId, token }: EditRoomModalProps) => {
  const initialId = (defaultRoomId && rooms.some((r) => r.id === defaultRoomId))
    ? defaultRoomId
    : rooms[0]?.id ?? "";
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialId);
  const [selectedColor, setSelectedColor] = useState<string>(
    rooms.find((r) => r.id === initialId)?.color ?? ""
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<EditRoomFormData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [linkData, setLinkData] = useState<{ room: string; link: string }[]>(() => {
    const saved = localStorage.getItem("syncData");
    return saved ? JSON.parse(saved) : (airbnbsync ?? []);
  });
  const [newLink, setNewLink] = useState("");

  const saveLinks = (updated: { room: string; link: string }[]) => {
    setLinkData(updated);
    localStorage.setItem("syncData", JSON.stringify(updated));
    updateSync(hostId, JSON.stringify(updated), token).catch(console.error);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  const roomLinks = linkData.filter((e) => e.room === selectedRoom?.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditRoomFormData>({
    resolver: zodResolver(editRoomSchema),
    values: {
      name: selectedRoom?.name ?? "",
      price: selectedRoom?.price ?? 0,
      roomCode: selectedRoom?.roomCode ?? "",
      active: selectedRoom?.active ?? true,
    },
  });

  const handleRoomChange = (id: string) => {
    setSelectedRoomId(id);
    setErrorMessage("");
    const room = rooms.find((r) => r.id === id);
    if (room) {
      setSelectedColor(room.color ?? "");
      reset({
        name: room.name,
        price: room.price,
        roomCode: room.roomCode ?? "",
        active: room.active ?? true,
      });
    }
  };

  const onSubmit: SubmitHandler<EditRoomFormData> = (data) => {
    if (!selectedRoom) return;
    setErrorMessage("");
    const nameExistsInList = rooms.some((r) => r.name === data.name);
    if (!nameExistsInList) {
      setPendingConfirm(data);
      return;
    }
    onSave({ ...selectedRoom, ...data, color: selectedColor }, (msg) => setErrorMessage(msg));
  };

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
          <h2 className="font-bold text-lg">Manage Room</h2>
        </div>

        {/* Room selector */}
        <div>
          <label className="block text-sm font-medium mb-1">Select Room</label>
          <select
            className="border border-gray-300 rounded px-2 py-1 w-full"
            value={selectedRoomId}
            onChange={(e) => handleRoomChange(e.target.value)}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={handleSubmit(onSubmit, (validationErrors) => {
            const first = Object.values(validationErrors)[0];
            setErrorMessage(first?.message ?? "Please fix the errors above.");
          })}
        >
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              type="text"
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("name")}
            />
            {errors.name && (
              <span className="text-red-500 text-sm">{errors.name.message}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Price (per night)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("price", { valueAsNumber: true })}
            />
            {errors.price && (
              <span className="text-red-500 text-sm">{errors.price.message}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Room Code</label>
            <input
              type="text"
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("roomCode")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full ${c} ${selectedColor === c ? "ring-2 ring-offset-2 ring-gray-800" : ""}`}
                  onClick={() => setSelectedColor(selectedColor === c ? "" : c)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activeCheckbox"
              className="w-4 h-4"
              {...register("active")}
            />
            <label htmlFor="activeCheckbox" className="text-sm font-medium">
              Active
            </label>
          </div>

          {errorMessage && (
            <p className="text-red-500 text-sm">{errorMessage}</p>
          )}

          <div className="flex gap-2 justify-between">
            <button
              type="button"
              onClick={() => { setConfirmDelete(true); setPendingConfirm(null); }}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-gray-400 text-white text-sm rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-green-500 text-white text-sm rounded"
              >
                Save
              </button>
            </div>
          </div>
        </form>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="border border-red-400 bg-red-50 rounded p-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-red-800">
              Delete "{selectedRoom?.name}"? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-2 py-1 bg-red-500 text-white text-sm rounded"
                onClick={() => {
                  if (!selectedRoom) return;
                  onDelete(selectedRoom.id, (msg) => { setErrorMessage(msg); setConfirmDelete(false); });
                }}
              >
                Yes, Delete
              </button>
              <button
                type="button"
                className="flex-1 px-2 py-1 bg-gray-300 text-gray-700 text-sm rounded"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Link AirBnB */}
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
          <p className="text-sm font-semibold text-gray-700">Link AirBnB Calendar</p>
          {roomLinks.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {roomLinks.map((entry, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="flex-1 truncate">{entry.link}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 text-xs font-medium shrink-0"
                    onClick={() => saveLinks(linkData.filter((e) => e !== entry))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No link set for this room.</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste AirBnB .ics link"
              className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
            />
            <button
              type="button"
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded shrink-0"
              onClick={() => {
                if (!newLink.trim() || !selectedRoom) return;
                saveLinks([...linkData, { room: selectedRoom.id, link: newLink.trim() }]);
                setNewLink("");
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Confirmation dialog when name doesn't match any existing room */}
        {pendingConfirm && (
          <div className="border border-yellow-400 bg-yellow-50 rounded p-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-yellow-800">
              "{pendingConfirm.name}" is not in your room list. What would you like to do?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-2 py-1 bg-blue-500 text-white text-sm rounded"
                onClick={() => {
                  onAdd(
                    { name: pendingConfirm.name, price: pendingConfirm.price, roomCode: pendingConfirm.roomCode, color: selectedColor },
                    (msg) => { setErrorMessage(msg); setPendingConfirm(null); },
                  );
                }}
              >
                Add New Room
              </button>
              <button
                type="button"
                className="flex-1 px-2 py-1 bg-green-500 text-white text-sm rounded"
                onClick={() => {
                  if (!selectedRoom) return;
                  onSave({ ...selectedRoom, ...pendingConfirm, color: selectedColor }, (msg) => {
                    setErrorMessage(msg);
                    setPendingConfirm(null);
                  });
                }}
              >
                Rename Room
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-gray-300 text-gray-700 text-sm rounded"
                onClick={() => setPendingConfirm(null)}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default EditRoomModal;