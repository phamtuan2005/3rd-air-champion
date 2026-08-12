import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FaChevronDown } from "react-icons/fa";
import { guestType } from "../../../../util/types/guestType";
import { roomType } from "../../../../util/types/roomType";
import RoomBadge from "../../../shared/RoomBadge";
import PickerModal, { PickerOption } from "../../../shared/PickerModal";
import CleanerAvatar from "../../../shared/CleanerAvatar";
import { GUEST_AVATAR_PRESETS } from "../../../../util/guestAvatars";

const manageGuestSchema = z.object({
  name: z
    .string()
    .min(3, "Must be at least 3 characters long")
    .regex(/^[^!@#$%^&*()_+=[\]{};:"\\|,<>/?~]+$/, {
      message: "Name cannot contain a special character",
    }),
  phone: z.string().refine((val) => {
    const digits = val.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Phone number must have between 10 and 15 digits."),
  email: z.string().optional(),
  notes: z.string().optional(),
});

type ManageGuestFormData = z.infer<typeof manageGuestSchema>;

// One field style for the whole modal. Previously every input repeated its own
// border and padding, which is how they drift apart.
const FIELD =
  "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none";
const LABEL = "block text-xs font-semibold text-gray-600";

const prettyPhone = (raw?: string) => {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw ?? "";
};

interface ManageGuestModalProps {
  guests: guestType[];
  rooms: roomType[];
  onClose: () => void;
  onSave: (guest: guestType, onError: (msg: string) => void) => void;
  onAdd: (
    guest: {
      name: string;
      phone: string;
      email?: string;
      notes?: string;
      returning: boolean;
    },
    onError: (msg: string) => void,
  ) => void;
  onDelete: (guestId: string, onError: (msg: string) => void) => void;
}

const ManageGuestModal = ({
  guests,
  rooms,
  onClose,
  onSave,
  onAdd,
  onDelete,
}: ManageGuestModalProps) => {
  const selectableGuests = guests
    .filter((g) => g.name !== "AirBnB")
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeRooms = [...rooms]
    .filter((r) => r.active)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Per-room rates, held as STRINGS so "empty" and "0" stay different things.
  //
  // That distinction is the whole design here. An empty box means this guest has
  // no override and pays the room's own rate. A typed 0 means comped — and there
  // are real guests on deliberate $0 rates, so a blank must never be saved as
  // zero, nor a zero quietly turned into the room rate.
  const pricesFor = (guest?: guestType) => {
    const out: Record<string, string> = {};
    for (const room of rooms) {
      const existing = guest?.pricing?.find((p) => p.room === room.id);
      out[room.id] = existing ? String(existing.price) : "";
    }
    return out;
  };

  const [selectedGuestId, setSelectedGuestId] = useState<string>(
    selectableGuests[0]?.id ?? "",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingConfirm, setPendingConfirm] =
    useState<ManageGuestFormData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guestPickerOpen, setGuestPickerOpen] = useState(false);
  const [character, setCharacter] = useState("");

  const selectedGuest =
    selectableGuests.find((g) => g.id === selectedGuestId) ??
    selectableGuests[0];

  const [prices, setPrices] = useState<Record<string, string>>(() =>
    pricesFor(selectedGuest),
  );
  // Seeded from the guest on first render; kept in step by handleGuestChange.
  const [characterInit, setCharacterInit] = useState(false);
  if (!characterInit && selectedGuest) {
    setCharacter(selectedGuest.character ?? "");
    setCharacterInit(true);
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManageGuestFormData>({
    resolver: zodResolver(manageGuestSchema),
    values: {
      name: selectedGuest?.name ?? "",
      phone: selectedGuest?.phone ?? "",
      email: selectedGuest?.email ?? "",
      notes: selectedGuest?.notes ?? "",
    },
  });

  const handleGuestChange = (id: string) => {
    setSelectedGuestId(id);
    setErrorMessage("");
    setPendingConfirm(null);
    setConfirmDelete(false);
    const guest = selectableGuests.find((g) => g.id === id);
    setPrices(pricesFor(guest));
    setCharacter(guest?.character ?? "");
    if (guest) {
      reset({
        name: guest.name,
        phone: guest.phone ?? "",
        email: guest.email ?? "",
        notes: guest.notes ?? "",
      });
    }
  };

  // Only rooms with something typed in. A blank box is "no override", which is
  // not the same as an override of zero and must not be sent as one.
  const pricingFromInputs = () =>
    activeRooms
      .filter((room) => (prices[room.id] ?? "").trim() !== "")
      .map((room) => ({ room: room.id, price: Number(prices[room.id]) }))
      .filter((p) => Number.isFinite(p.price) && p.price >= 0);

  const onSubmit: SubmitHandler<ManageGuestFormData> = (data) => {
    if (!selectedGuest) return;
    setErrorMessage("");
    const cleaned = { ...data, phone: data.phone.replace(/\D/g, "") };
    const nameExistsInList = selectableGuests.some(
      (g) => g.name === cleaned.name,
    );
    if (!nameExistsInList) {
      setPendingConfirm(cleaned);
      return;
    }
    onSave(
      { ...selectedGuest, ...cleaned, pricing: pricingFromInputs(), character },
      (msg) => setErrorMessage(msg),
    );
  };

  // The guest list as picker rows: name in bold, phone underneath. The phone is
  // what separates two guests with the same first name, so it belongs in the
  // list rather than only appearing after the choice is made.
  const guestOptions: PickerOption<string>[] = selectableGuests.map((g) => ({
    value: g.id,
    label: g.name,
    hint: prettyPhone(g.phone) || undefined,
    // Initials in a stable per-name colour — the same avatar the cleaners get,
    // so a person looks like a person everywhere in TiMag. Nothing to upload,
    // nothing stored: no photos on a disk whose filling up takes mongod with it,
    // and no guest faces held for a need that does not exist.
    node: <CleanerAvatar name={g.name} character={g.character} sizeClass="h-8 w-8" />,
    rowActive: "bg-gray-50 text-gray-900",
  }));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">Manage guest</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {selectableGuests.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No returning guests found.
          </p>
        ) : (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
            {/* Guest selector — a picker, not a native select, which opens the
                OS wheel on a phone and looks nothing like the app. */}
            <div>
              <label className={LABEL}>Guest</label>
              <button
                type="button"
                onClick={() => setGuestPickerOpen(true)}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-1.5 text-left"
              >
                <CleanerAvatar
                  name={selectedGuest?.name ?? ""}
                  character={character}
                  sizeClass="h-8 w-8"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">
                    {selectedGuest?.name}
                  </span>
                  {selectedGuest?.phone && (
                    <span className="block text-[11px] leading-tight text-gray-500">
                      {prettyPhone(selectedGuest.phone)}
                    </span>
                  )}
                </span>
                <FaChevronDown size={10} className="shrink-0 text-gray-400" />
              </button>
            </div>

            <form
              className="flex flex-col gap-3"
              onSubmit={handleSubmit(onSubmit, (validationErrors) => {
                const first = Object.values(validationErrors)[0];
                setErrorMessage(
                  first?.message ?? "Please fix the errors above.",
                );
              })}
            >
              <div>
                <label className={LABEL}>Name</label>
                <input type="text" className={`mt-1 ${FIELD}`} {...register("name")} />
                {errors.name && (
                  <span className="text-xs text-red-500">{errors.name.message}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>Phone</label>
                  <input type="tel" className={`mt-1 ${FIELD}`} {...register("phone")} />
                  {errors.phone && (
                    <span className="text-xs text-red-500">{errors.phone.message}</span>
                  )}
                </div>
                <div>
                  <label className={LABEL}>Email</label>
                  <input type="email" className={`mt-1 ${FIELD}`} {...register("email")} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Avatar</label>
                {/* Every option drawn with THIS guest's name as the seed, so the
                    grid shows what they will actually look like rather than a
                    generic sample. Two guests picking the same look still get
                    different faces, because the name is part of the seed. */}
                <div className="mt-1 grid grid-cols-6 gap-1.5 rounded-xl border border-gray-200 p-2">
                  {GUEST_AVATAR_PRESETS.map((preset) => {
                    const selected = character === preset.character;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        onClick={() => setCharacter(preset.character)}
                        className={`flex items-center justify-center rounded-lg p-0.5 transition-all ${
                          selected ? "ring-2 ring-gray-900" : "ring-1 ring-transparent hover:ring-gray-300"
                        }`}
                      >
                        <CleanerAvatar
                          name={selectedGuest?.name ?? ""}
                          character={preset.character}
                          sizeClass="h-9 w-9"
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] leading-tight text-gray-400">
                  Drawn, not uploaded — nothing is stored but the choice. The first
                  option returns to plain initials.
                </p>
              </div>

              <div>
                <label className={LABEL}>Notes</label>
                <textarea className={`mt-1 ${FIELD}`} rows={2} {...register("notes")} />
              </div>

              {activeRooms.length > 0 && (
                <div>
                  <label className={LABEL}>Room rates</label>
                  <div className="mt-1 divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {activeRooms.map((room) => (
                      <div key={room.id} className="flex items-center gap-2 px-2.5 py-2">
                        {/* The shared badge, so a room looks the same here as it
                            does on the calendar, in bookings and in Stats. */}
                        <RoomBadge room={room} rooms={activeRooms} />
                        <span className="flex-1" />
                        <span className="text-sm text-gray-400">$</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          // The room's own rate as placeholder, so an empty box
                          // reads as "pays the usual" rather than as missing data.
                          placeholder={String(room.price ?? "")}
                          value={prices[room.id] ?? ""}
                          onChange={(e) =>
                            setPrices((p) => ({ ...p, [room.id]: e.target.value }))
                          }
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm focus:border-gray-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  {/* Says what the code actually does. There is no endpoint to
                      delete a saved rate, so promising that a cleared box removes
                      one would be a lie the host only discovers later. */}
                  <p className="mt-1 text-[11px] leading-tight text-gray-400">
                    Blank means this guest pays the room's usual rate. Enter 0 to comp a
                    room. A saved rate can be changed, but not cleared.
                  </p>
                </div>
              )}

              {errorMessage && (
                <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
                  {errorMessage}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                {/* Destructive action kept quiet and apart from the everyday
                    ones — it still arms a confirmation before anything happens. */}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(true);
                    setPendingConfirm(null);
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>

            {/* Name mismatch confirmation */}
            {pendingConfirm && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">
                  "{pendingConfirm.name}" is not in your guest list. What would you like
                  to do?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      onAdd(
                        {
                          name: pendingConfirm.name,
                          phone: pendingConfirm.phone,
                          email: pendingConfirm.email,
                          notes: pendingConfirm.notes,
                          returning: true,
                        },
                        (msg) => {
                          setErrorMessage(msg);
                          setPendingConfirm(null);
                        },
                      );
                    }}
                  >
                    Add new
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      if (!selectedGuest) return;
                      onSave({ ...selectedGuest, ...pendingConfirm }, (msg) => {
                        setErrorMessage(msg);
                        setPendingConfirm(null);
                      });
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300"
                    onClick={() => setPendingConfirm(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Delete confirmation */}
            {confirmDelete && (
              <div className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-900">
                  Delete "{selectedGuest?.name}"? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      if (!selectedGuest) return;
                      onDelete(selectedGuest.id, (msg) => {
                        setErrorMessage(msg);
                        setConfirmDelete(false);
                      });
                    }}
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PickerModal
        open={guestPickerOpen}
        title="Choose guest"
        subtitle={`${selectableGuests.length} returning guests`}
        options={guestOptions}
        value={selectedGuestId}
        onChange={handleGuestChange}
        onClose={() => setGuestPickerOpen(false)}
      />
    </div>,
    document.body,
  );
};

export default ManageGuestModal;
