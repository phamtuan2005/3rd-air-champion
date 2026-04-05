import { useState } from "react";
import { bookingType } from "../../../../util/types/bookingType";

interface AirBnBPricingProps {
  booking: bookingType;
  editingKey: string | null;
  onAirbnbPriceUpdate: (bookingId: string, airbnbPrice: number) => void;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
}

const AirBnBPricing = ({
  booking,
  editingKey,
  onAirbnbPriceUpdate,
  setEditingKey,
}: AirBnBPricingProps) => {
  const key = `${booking.room.name}_${booking.startDate}_${booking.endDate}`;
  const storedPrice = booking.airbnbPrice || 0;

  const [price, setPrice] = useState<number | string>(storedPrice);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === "") {
      setPrice("");
    } else {
      const parsedValue = parseFloat(inputValue);
      setPrice(isNaN(parsedValue) ? "" : parsedValue);
    }
  };

  const handleSavePrice = () => {
    const newPrice = price === "" ? 0 : Math.max(0, Number(price));
    onAirbnbPriceUpdate(booking.id, newPrice);
    setEditingKey(null);
  };

  return (
    <div>
      {editingKey === key ? (
        <div className="flex space-x-2">
          <input
            type="number"
            value={price}
            onChange={handlePriceChange}
            className="border p-1 w-24"
          />
          <button
            onClick={handleSavePrice}
            className="bg-blue-500 text-white px-2 py-1 rounded-md"
          >
            Save
          </button>
          <button
            onClick={() => setEditingKey(null)}
            className="bg-gray-500 text-white px-2 py-1 rounded-md"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div
          className="flex space-x-1 cursor-pointer underline"
          onClick={() => {
            setPrice(booking.airbnbPrice || 0);
            setEditingKey(key);
          }}
        >
          <span className="text-sm whitespace-nowrap">
            Profit: ${storedPrice}
          </span>
        </div>
      )}
    </div>
  );
};

export default AirBnBPricing;
