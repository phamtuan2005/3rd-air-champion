import { z } from "zod";

export const loginZodObject = z.object({
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .nonempty({ message: "Email required" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .max(64, { message: "Password must be no more than 64 characters long" })
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[`!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/, {
      message: "Password must contain at least one special character",
    })
    .regex(/^\S*$/, { message: "Password must not contain spaces" }),
});

export type loginSchema = z.infer<typeof loginZodObject>;