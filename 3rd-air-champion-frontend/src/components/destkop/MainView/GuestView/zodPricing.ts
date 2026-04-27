import z from "zod";

export const pricingZodObject = z.object({
  pricing: z.array(
    z.object({
      id: z.string().optional(),
      room: z.string(),
      price: z.number().min(0, "Price must be a positive number"),
    })
  ),
});

export type pricingZodSchema = z.infer<typeof pricingZodObject>;