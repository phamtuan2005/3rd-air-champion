import {
  useForm,
  Controller,
  useFieldArray,
  SubmitHandler,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookingType } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import {
  pricingZodObject,
  pricingZodSchema,
} from "../../../../util/zodPricing";
import PricingDropdown from "./PricingDropdown";

interface PricingProps {
  booking: bookingType;
  isEditing: boolean;
  rooms: roomType[];
  onPricingUpdate: (
    data: {
      guest: string;
      room: string;
      price: number;
    }[],
  ) => void;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

const Pricing = ({
  booking,
  isEditing,
  rooms,
  onPricingUpdate,
  setIsEditing,
}: PricingProps) => {
  // Initialize React Hook Form
  const { control, handleSubmit } = useForm<pricingZodSchema>({
    resolver: zodResolver(pricingZodObject),
    defaultValues: {
      pricing: rooms.map((room) => {
        const roomPricing = booking.guest.pricing?.find(
          (price) => price.room === room.id,
        );
        return {
          room: room.id,
          price: roomPricing?.price || 0,
        };
      }),
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "pricing",
  });

  const onSubmit: SubmitHandler<pricingZodSchema> = (data) => {
    const updatedPricing = data.pricing.map((pricing) => ({
      ...pricing,
      guest: booking.guest.id,
    }));

    console.log("Updated Pricing:", updatedPricing);
    onPricingUpdate(updatedPricing);
    setIsEditing(false); // Exit edit mode after saving
  };

  return (
    <div>
      {isEditing ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col space-y-1 py-1"
        >
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center space-x-4">
              <span className="basis-1/3">{rooms[index].name}:</span>
              <Controller
                name={`pricing.${index}.price`}
                control={control}
                render={({ field, fieldState }) => (
                  <div className="flex flex-col">
                    <input
                      {...field}
                      type="number"
                      className="border p-1 w-24"
                      step="0.01"
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ""
                            ? event.target.value
                            : +event.target.value,
                        )
                      }
                    />
                    {fieldState.error && (
                      <span className="text-red-500 text-sm">
                        {fieldState.error.message}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>
          ))}
          <div className="flex items-center space-x-4 py-1">
            <button
              type="submit"
              className="bg-blue-500 text-white px-2 py-1 rounded-md"
            >
              Save All
            </button>
            <button
              type="button"
              className="bg-gray-500 text-white px-2 py-1 rounded-md"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex w-full justify-between items-center space-x-2 py-1">
          <button
            className="bg-blue-500 text-white px-2 py-1 rounded-md"
            onClick={() => setIsEditing(true)}
          >
            Edit Pricing
          </button>
          <PricingDropdown fields={fields} rooms={rooms} />
        </div>
      )}
    </div>
  );
};

export default Pricing;
