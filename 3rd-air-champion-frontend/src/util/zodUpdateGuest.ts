import z from "zod";

export const guestUpdateZodObject = z.object({
  alias: z
    .string()
    .min(3, "Must be at least 3 characters long")
    .regex(/^[^!@#$%^&*()_+=[\]{};:"\\|,<>/?~]+$/, {
      message: "Name cannot contain a special character",
    }),
  notes: z.string().optional(),
  numberOfGuests: z
    .number("Must be a number")
    .min(1, { message: "Must be at least 1 guest" }),
});

export type guestUpdateSchema = z.infer<typeof guestUpdateZodObject>;
