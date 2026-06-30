import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { guestAddSchema, guestAddZodObject } from "./zodAddGuest";

interface GuestAddPaneProps {
  guestErrorMessage: string;
  onAddGuest: (guestObject: { name: string; phone: string }) => void;
}

const GuestAddPane = ({ guestErrorMessage, onAddGuest }: GuestAddPaneProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<guestAddSchema>({ resolver: zodResolver(guestAddZodObject) });

  const onSubmit: SubmitHandler<guestAddSchema> = (data) => {
    // Strip formatting — store the phone as digits only.
    onAddGuest({ name: data.name, phone: data.phone.replace(/\D/g, "") });
  };

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Add Guest</h3>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="guestName" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="guestName"
            type="text"
            className="border border-gray-300 rounded px-2 py-1 w-full"
            {...register("name")}
          />
          {errors.name && (
            <span className="text-red-500 text-sm">{errors.name.message}</span>
          )}
        </div>
        <div>
          <label htmlFor="guestPhone" className="block text-sm font-medium">
            Phone
          </label>
          <input
            id="guestPhone"
            type="tel"
            className="border border-gray-300 rounded px-2 py-1 w-full"
            {...register("phone")}
          />
          {errors.phone && (
            <span className="text-red-500 text-sm">{errors.phone.message}</span>
          )}
        </div>
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-slate-500"
          disabled={
            !(watch("name") && watch("phone")) || Object.keys(errors).length > 0
          }
        >
          Save Guest
        </button>
        {guestErrorMessage && (
          <p className="text-red-500">{guestErrorMessage}</p>
        )}
      </form>
    </div>
  );
};

export default GuestAddPane;
