import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { guestType } from "../../../../util/types/guestType";

const manageGuestSchema = z.object({
  name: z
    .string()
    .min(3, "Must be at least 3 characters long")
    .regex(/^[^!@#$%^&*()_+=[\]{};:"\\|,<>/?~]+$/, {
      message: "Name cannot contain a special character",
    }),
  phone: z.string().refine(
    (val) => {
      const digits = val.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    },
    "Phone number must have between 10 and 15 digits."
  ),
  email: z.string().optional(),
  notes: z.string().optional(),
});

type ManageGuestFormData = z.infer<typeof manageGuestSchema>;

interface ManageGuestModalProps {
  guests: guestType[];
  onClose: () => void;
  onSave: (guest: guestType, onError: (msg: string) => void) => void;
  onAdd: (guest: { name: string; phone: string; email?: string; notes?: string; returning: boolean }, onError: (msg: string) => void) => void;
  onDelete: (guestId: string, onError: (msg: string) => void) => void;
}

const ManageGuestModal = ({ guests, onClose, onSave, onAdd, onDelete }: ManageGuestModalProps) => {
  const selectableGuests = guests
    .filter((g) => g.name !== "AirBnB" && g.returning === true)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [selectedGuestId, setSelectedGuestId] = useState<string>(selectableGuests[0]?.id ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<ManageGuestFormData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedGuest = selectableGuests.find((g) => g.id === selectedGuestId) ?? selectableGuests[0];

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
    if (guest) {
      reset({
        name: guest.name,
        phone: guest.phone ?? "",
        email: guest.email ?? "",
        notes: guest.notes ?? "",
      });
    }
  };

  const onSubmit: SubmitHandler<ManageGuestFormData> = (data) => {
    if (!selectedGuest) return;
    setErrorMessage("");
    const cleaned = { ...data, phone: data.phone.replace(/\D/g, "") };
    const nameExistsInList = selectableGuests.some((g) => g.name === cleaned.name);
    if (!nameExistsInList) {
      setPendingConfirm(cleaned);
      return;
    }
    onSave({ ...selectedGuest, ...cleaned }, (msg) => setErrorMessage(msg));
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
          <h2 className="font-bold text-lg">Manage Guest</h2>
        </div>

        {selectableGuests.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No returning guests found.</p>
        ) : (
          <>
            {/* Guest selector */}
            <div>
              <label className="block text-sm font-medium mb-1">Select Guest</label>
              <select
                className="border border-gray-300 rounded px-2 py-1 w-full"
                value={selectedGuestId}
                onChange={(e) => handleGuestChange(e.target.value)}
              >
                {selectableGuests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name}
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
                {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                  {...register("phone")}
                />
                {errors.phone && <span className="text-red-500 text-sm">{errors.phone.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                  {...register("email")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Notes</label>
                <textarea
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                  rows={2}
                  {...register("notes")}
                />
              </div>

              {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}

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

            {/* Name mismatch confirmation */}
            {pendingConfirm && (
              <div className="border border-yellow-400 bg-yellow-50 rounded p-3 flex flex-col gap-2">
                <p className="text-sm font-medium text-yellow-800">
                  "{pendingConfirm.name}" is not in your guest list. What would you like to do?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 px-2 py-1 bg-blue-500 text-white text-sm rounded"
                    onClick={() => {
                      onAdd(
                        { name: pendingConfirm.name, phone: pendingConfirm.phone, email: pendingConfirm.email, notes: pendingConfirm.notes, returning: true },
                        (msg) => { setErrorMessage(msg); setPendingConfirm(null); },
                      );
                    }}
                  >
                    Add New Guest
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-2 py-1 bg-green-500 text-white text-sm rounded"
                    onClick={() => {
                      if (!selectedGuest) return;
                      onSave({ ...selectedGuest, ...pendingConfirm }, (msg) => {
                        setErrorMessage(msg);
                        setPendingConfirm(null);
                      });
                    }}
                  >
                    Rename Guest
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

            {/* Delete confirmation */}
            {confirmDelete && (
              <div className="border border-red-400 bg-red-50 rounded p-3 flex flex-col gap-2">
                <p className="text-sm font-medium text-red-800">
                  Delete "{selectedGuest?.name}"? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 px-2 py-1 bg-red-500 text-white text-sm rounded"
                    onClick={() => {
                      if (!selectedGuest) return;
                      onDelete(selectedGuest.id, (msg) => { setErrorMessage(msg); setConfirmDelete(false); });
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
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ManageGuestModal;