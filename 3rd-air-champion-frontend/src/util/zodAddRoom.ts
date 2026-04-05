import { z } from "zod";

export const roomAddZodObject = z.object({
  name: z
    .string()
    .min(3, "Must be at least 3 characters long")
    .regex(/^[^!@#$%^&*()_+=[\]{};:"\\|,<>/?~]+$/, {
      message: "Name cannot contain a special character",
    }),
  price: z
    .number("Must be a number")
    .min(0, { message: "Price cannot be negative" }),
});

export type roomAddSchema = z.infer<typeof roomAddZodObject>;
