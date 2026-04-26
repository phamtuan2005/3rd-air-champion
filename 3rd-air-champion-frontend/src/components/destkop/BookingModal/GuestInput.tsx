import React, { useState } from "react";
import { guestType } from "../../../util/types/guestType";
import { UseFormSetValue } from "react-hook-form";
import { bookDaySchema } from "./zodBookDays";

interface GuestInputProps {
  guests: guestType[];
  showAddPane: "guest" | "room" | null;
  setShowAddPane: React.Dispatch<React.SetStateAction<"guest" | "room" | null>>;
  setValue: UseFormSetValue<bookDaySchema>;
  defaultGuest?: guestType | null;
}

const GuestInput = ({
  guests,
  showAddPane,
  setShowAddPane,
  setValue,
  defaultGuest,
}: GuestInputProps) => {
  const [filteredGuests, setFilteredGuests] = useState<guestType[]>([]);
  const [searchQuery, setSearchQuery] = useState(
    defaultGuest ? `${defaultGuest.name} (${defaultGuest.phone})` : "",
  );
  const [isGuestFound, setIsGuestFound] = useState(!!defaultGuest);

  // Filter guests based on search query
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsGuestFound(false);
    const query = e.target.value;
    setSearchQuery(query);
    setValue("guest", query, { shouldValidate: true });

    // Filter guests by name
    setFilteredGuests(
      guests.filter((guest) =>
        guest.name.toLowerCase().includes(query.toLowerCase())
      )
    );
  };

  const handleSelectGuest = (guest: guestType) => {
    setSearchQuery(`${guest.name} (${guest.phone})`); // Display selected guest
    setIsGuestFound(true);
    setValue("guest", guest.id, { shouldValidate: true });
    setFilteredGuests([]); // Clear suggestions
  };

  return (
    <div>
      <label htmlFor="guest" className="block text-sm font-medium mb-1">
        Guest
      </label>
      <div className="relative flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            id="guest"
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            className={`border rounded px-2 py-1 w-full pr-7 ${
              isGuestFound
                ? "border-green-400 bg-green-50"
                : "border-gray-300"
            }`}
            placeholder="Type guest name..."
          />
          {isGuestFound && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 font-bold text-sm pointer-events-none">
              ✓
            </span>
          )}
          {filteredGuests.length > 0 && searchQuery !== "" ? (
            <ul className="absolute bg-white border border-gray-300 rounded w-full mt-1 max-h-40 overflow-y-auto z-20">
              {filteredGuests.map((guest) => (
                <li
                  key={guest.id}
                  onClick={() => handleSelectGuest(guest)}
                  className="px-2 py-1 hover:bg-gray-200 cursor-pointer"
                >
                  {`${guest.name} (${guest.phone})`}
                </li>
              ))}
            </ul>
          ) : (
            showAddPane !== "guest" &&
            searchQuery !== "" &&
            !isGuestFound && (
              <ul className="absolute bg-white border border-gray-300 rounded w-full mt-1 max-h-40 overflow-y-auto z-20">
                <li
                  className="px-2 py-1 hover:bg-gray-200 cursor-pointer"
                  onClick={() => setShowAddPane("guest")}
                >
                  Add Guest
                </li>
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestInput;
