import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { roomType } from "../../../../util/types/roomType";
import { updateSync } from "../../../../util/hostOperations";
import RoomPhotosEditor from "./RoomPhotosEditor";

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

const TEMPLATE_VARS = [
  { token: "{{guestName}}",    label: "Guest Name",     hint: "e.g. Sarah" },
  { token: "{{roomName}}",     label: "Room Name",      hint: "e.g. King Suite" },
  { token: "{{roomCode}}",     label: "Room Code",      hint: "smart lock code" },
  { token: "{{doorCode}}",     label: "Door Code",      hint: "entry door code" },
  { token: "{{checkInDate}}",  label: "Check-In Date",  hint: "e.g. Jun 5" },
  { token: "{{checkOutDate}}", label: "Check-Out Date", hint: "e.g. Jun 8" },
  { token: "{{duration}}",     label: "Nights",         hint: "e.g. 3" },
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

  const [activeTab, setActiveTab] = useState<"room" | "checkin">("room");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialId);
  const [selectedColor, setSelectedColor] = useState<string>(rooms.find((r) => r.id === initialId)?.color ?? "");
  const [roomAirbnbUrl, setRoomAirbnbUrl] = useState<string>(rooms.find((r) => r.id === initialId)?.airbnbUrl ?? "");
  const [roomCheckInInstructions, setRoomCheckInInstructions] = useState<string>(rooms.find((r) => r.id === initialId)?.checkInInstructions ?? "");
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<EditRoomFormData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [linkData, setLinkData] = useState<{ room: string; link: string }[]>(() => {
    const saved = localStorage.getItem("syncData");
    return saved ? JSON.parse(saved) : (airbnbsync ?? []);
  });
  const [newLink, setNewLink] = useState("");
  const [roomPhotos, setRoomPhotos] = useState<string[]>(rooms.find((r) => r.id === initialId)?.photos ?? []);

  const saveLinks = (updated: { room: string; link: string }[]) => {
    setLinkData(updated);
    localStorage.setItem("syncData", JSON.stringify(updated));
    updateSync(hostId, JSON.stringify(updated), token).catch(console.error);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];
  const roomLinks = linkData.filter((e) => e.room === selectedRoom?.id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditRoomFormData>({
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
    setInstructionsSaved(false);
    const room = rooms.find((r) => r.id === id);
    if (room) {
      setSelectedColor(room.color ?? "");
      setRoomPhotos(room.photos ?? []);
      setRoomAirbnbUrl(room.airbnbUrl ?? "");
      setRoomCheckInInstructions(room.checkInInstructions ?? "");
      reset({ name: room.name, price: room.price, roomCode: room.roomCode ?? "", active: room.active ?? true });
    }
  };

  const onSubmit: SubmitHandler<EditRoomFormData> = (data) => {
    if (!selectedRoom) return;
    setErrorMessage("");
    const nameExistsInList = rooms.some((r) => r.name === data.name);
    if (!nameExistsInList) { setPendingConfirm(data); return; }
    onSave({ ...selectedRoom, ...data, color: selectedColor, photos: roomPhotos, airbnbUrl: roomAirbnbUrl, checkInInstructions: roomCheckInInstructions }, (msg) => setErrorMessage(msg));
  };

  const handleSaveInstructions = () => {
    if (!selectedRoom) return;
    onSave({ ...selectedRoom, checkInInstructions: roomCheckInInstructions }, (msg) => setErrorMessage(msg));
    setInstructionsSaved(true);
    setTimeout(() => setInstructionsSaved(false), 2000);
  };

  const insertToken = (token: string) => {
    const el = instructionsRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setRoomCheckInInstructions(next);
    setInstructionsSaved(false);
    // restore focus and place cursor after inserted token
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const tabs = [
    { key: "room" as const, label: "Room" },
    { key: "checkin" as const, label: "Check-In" },
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg w-full max-w-sm shadow-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-1 px-4 pt-4 pb-2 shrink-0">
          <button onClick={onClose} className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100">&times;</button>
          <h2 className="font-bold text-lg">Manage Room</h2>
        </div>

        {/* Room selector + tabs — always visible */}
        <div className="px-4 pb-2 shrink-0 flex flex-col gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Select Room</label>
            <select className="border border-gray-300 rounded px-2 py-1 w-full" value={selectedRoomId} onChange={(e) => handleRoomChange(e.target.value)}>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </div>

          <div className="flex border-b border-gray-200">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === t.key
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable tab content */}
        <div className="overflow-y-auto px-4 pb-4 flex flex-col gap-3">

          {/* ── ROOM TAB ── */}
          {activeTab === "room" && (
            <>
              <form
                className="flex flex-col gap-3"
                onSubmit={handleSubmit(onSubmit, (validationErrors) => {
                  const first = Object.values(validationErrors)[0];
                  setErrorMessage(first?.message ?? "Please fix the errors above.");
                })}
              >
                <div>
                  <label className="block text-sm font-medium">Name</label>
                  <input type="text" className="border border-gray-300 rounded px-2 py-1 w-full" {...register("name")} />
                  {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
                </div>

                <div>
                  <label className="block text-sm font-medium">Price (per night)</label>
                  <input type="number" min={0} step={0.01} className="border border-gray-300 rounded px-2 py-1 w-full" {...register("price", { valueAsNumber: true })} />
                  {errors.price && <span className="text-red-500 text-sm">{errors.price.message}</span>}
                </div>

                <div>
                  <label className="block text-sm font-medium">Room Code</label>
                  <input type="text" className="border border-gray-300 rounded px-2 py-1 w-full" {...register("roomCode")} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button key={c} type="button" className={`w-7 h-7 rounded-full ${c} ${selectedColor === c ? "ring-2 ring-offset-2 ring-gray-800" : ""}`} onClick={() => setSelectedColor(selectedColor === c ? "" : c)} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activeCheckbox" className="w-4 h-4" {...register("active")} />
                  <label htmlFor="activeCheckbox" className="text-sm font-medium">Active</label>
                </div>

                {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}

                <div className="flex gap-2 justify-between">
                  <button type="button" onClick={() => { setConfirmDelete(true); setPendingConfirm(null); }} className="px-3 py-1 bg-red-500 text-white text-sm rounded">Delete</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="px-3 py-1 bg-gray-400 text-white text-sm rounded">Cancel</button>
                    <button type="submit" className="px-3 py-1 bg-green-500 text-white text-sm rounded">Save</button>
                  </div>
                </div>
              </form>

              {confirmDelete && (
                <div className="border border-red-400 bg-red-50 rounded p-3 flex flex-col gap-2">
                  <p className="text-sm font-medium text-red-800">Delete "{selectedRoom?.name}"? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 px-2 py-1 bg-red-500 text-white text-sm rounded" onClick={() => { if (!selectedRoom) return; onDelete(selectedRoom.id, (msg) => { setErrorMessage(msg); setConfirmDelete(false); }); }}>Yes, Delete</button>
                    <button type="button" className="flex-1 px-2 py-1 bg-gray-300 text-gray-700 text-sm rounded" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3">
                <RoomPhotosEditor
                  photos={roomPhotos}
                  roomName={selectedRoom?.name ?? "misc"}
                  token={token}
                  onChange={(updated) => {
                    setRoomPhotos(updated);
                    if (selectedRoom) onSave({ ...selectedRoom, photos: updated, color: selectedColor, checkInInstructions: roomCheckInInstructions }, (msg) => setErrorMessage(msg));
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                <p className="text-sm font-semibold text-gray-700">AirBnB Listing URL</p>
                <p className="text-xs text-gray-400">Shown as a link on TiBook so guests can view the room on AirBnB.</p>
                <input type="url" placeholder="https://www.airbnb.com/rooms/..." className="border border-gray-300 rounded px-2 py-1 text-xs w-full" value={roomAirbnbUrl} onChange={(e) => setRoomAirbnbUrl(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                <p className="text-sm font-semibold text-gray-700">Link AirBnB Calendar</p>
                {roomLinks.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {roomLinks.map((entry, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="flex-1 truncate">{entry.link}</span>
                        <button type="button" className="text-red-500 hover:text-red-700 text-xs font-medium shrink-0" onClick={() => saveLinks(linkData.filter((e) => e !== entry))}>Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">No link set for this room.</p>
                )}
                <div className="flex gap-2">
                  <input type="text" placeholder="Paste AirBnB .ics link" className="border border-gray-300 rounded px-2 py-1 text-xs flex-1" value={newLink} onChange={(e) => setNewLink(e.target.value)} />
                  <button type="button" className="px-3 py-1 bg-blue-500 text-white text-xs rounded shrink-0" onClick={() => { if (!newLink.trim() || !selectedRoom) return; saveLinks([...linkData, { room: selectedRoom.id, link: newLink.trim() }]); setNewLink(""); }}>Add</button>
                </div>
              </div>

              {pendingConfirm && (
                <div className="border border-yellow-400 bg-yellow-50 rounded p-3 flex flex-col gap-2">
                  <p className="text-sm font-medium text-yellow-800">"{pendingConfirm.name}" is not in your room list. What would you like to do?</p>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 px-2 py-1 bg-blue-500 text-white text-sm rounded" onClick={() => { onAdd({ name: pendingConfirm.name, price: pendingConfirm.price, roomCode: pendingConfirm.roomCode, color: selectedColor }, (msg) => { setErrorMessage(msg); setPendingConfirm(null); }); }}>Add New Room</button>
                    <button type="button" className="flex-1 px-2 py-1 bg-green-500 text-white text-sm rounded" onClick={() => { if (!selectedRoom) return; onSave({ ...selectedRoom, ...pendingConfirm, color: selectedColor, photos: roomPhotos, airbnbUrl: roomAirbnbUrl, checkInInstructions: roomCheckInInstructions }, (msg) => { setErrorMessage(msg); setPendingConfirm(null); }); }}>Rename Room</button>
                    <button type="button" className="px-2 py-1 bg-gray-300 text-gray-700 text-sm rounded" onClick={() => setPendingConfirm(null)}>Back</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── CHECK-IN TAB ── */}
          {activeTab === "checkin" && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Check-In Instructions</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Shown to the guest on their next upcoming booking. Use the tokens below to personalize — they are automatically replaced with real values.
                </p>
              </div>

              {/* Template variable chips */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Insert variable</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map(({ token, label, hint }) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => insertToken(token)}
                      title={hint}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold hover:bg-green-100 transition-colors"
                    >
                      <span className="text-green-400">+</span> {label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={12}
                placeholder={`Hi {{guestName}}, welcome to {{roomName}}!\n\nYour room code is {{roomCode}}.\n\nCheck-in: {{checkInDate}}\nCheck-out: {{checkOutDate}}\n\n...`}
                ref={instructionsRef}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full resize-none focus:outline-none focus:border-green-400 leading-relaxed"
                value={roomCheckInInstructions}
                onChange={(e) => { setRoomCheckInInstructions(e.target.value); setInstructionsSaved(false); }}
              />

              {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}

              <button
                type="button"
                onClick={handleSaveInstructions}
                className={`w-full py-2 rounded text-white text-sm font-semibold transition-colors ${instructionsSaved ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"}`}
              >
                {instructionsSaved ? "Saved ✓" : "Save Instructions"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EditRoomModal;