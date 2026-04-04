import { roomType } from "../../../../util/types/roomType";
import { pricingType } from "../../../../util/types/pricingType";

interface PricingDropdownProps {
  fields: pricingType[];
  rooms: roomType[];
}

const PricingDropdown = ({ fields, rooms }: PricingDropdownProps) => {
  return (
    <select className="border p-1">
      <option value="">--All Room Prices--</option>
      {rooms.map((room) => (
        <option key={room.id} value={room.id} disabled>
          {room.name}: $
          {fields.find((field) => field.room === room.id)?.price || 0}
        </option>
      ))}
    </select>
  );
};

export default PricingDropdown;
