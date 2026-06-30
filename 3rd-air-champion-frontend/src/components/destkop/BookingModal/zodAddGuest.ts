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
    // Accept common phone formatting — digits plus ( ) + - . and spaces.
    .regex(/^[\d\s()+.\-]+$/, {
      message: "Phone number can only contain digits and ( ) + - . or spaces.",
    })
    // Validate by digit count (formatting is stripped on submit).
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      },
      { message: "Phone number must be 10–15 digits." },
    ),
});

export type guestAddSchema = z.infer<typeof guestAddZodObject>;