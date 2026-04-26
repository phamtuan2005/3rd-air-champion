import { z } from "zod";

export const guestAddZodObject = z.object({
  name: z
    .string()
    .min(3, "Must be at least 3 characters long")
    .regex(/^[^!@#$%^&*()_+=[\]{};:"\\|,<>/?~]+$/, {
      message: "Name cannot contain a special character",
    }),
  phone: z
    .string()
    .min(10, { message: "Phone number must be at least 10 characters long." })
    .max(15, { message: "Phone number must be at most 15 characters long." })
    .regex(/^\d+$/, { message: "Phone number must contain only digits." }),
});

export type guestAddSchema = z.infer<typeof guestAddZodObject>;