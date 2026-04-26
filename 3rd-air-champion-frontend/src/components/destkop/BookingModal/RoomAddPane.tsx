import { SubmitHandler, useForm } from "react-hook-form";
import { roomAddSchema, roomAddZodObject } from "./zodAddRoom";
import { zodResolver } from "@hookform/resolvers/zod";

interface RoomAddPaneProps {
  roomErrorMessage: string;
  onAddRoom: (roomObject: { name: string; price: number }) => void;
}

const RoomAddPane = ({ roomErrorMessage, onAddRoom }: RoomAddPaneProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<roomAddSchema>({
    resolver: zodResolver(roomAddZodObject),
    defaultValues: { price: 0 },
  });

  const onSubmit: SubmitHandler<roomAddSchema> = (data) => {
    onAddRoom(data);
  };

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Add Room</h3>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="roomName" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="roomName"
            type="text"
            className="border border-gray-300 rounded px-2 py-1 w-full"
            {...register("name")}
          />
          {errors.name && (
            <span className="text-red-500 text-sm">{errors.name.message}</span>
          )}
        </div>
        <div>
          <label htmlFor="roomPrice" className="block text-sm font-medium">
            Price
          </label>
          <input
            id="roomPrice"
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
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-slate-500"
          disabled={
            !(watch("name") && watch("price")) || Object.keys(errors).length > 0
          }
        >
          Save Room
        </button>
        {roomErrorMessage && <p className="text-red-500">{roomErrorMessage}</p>}
      </form>
    </div>
  );
};

export default RoomAddPane;
