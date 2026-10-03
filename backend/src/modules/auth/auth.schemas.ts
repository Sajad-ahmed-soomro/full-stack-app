import { z } from "zod";

export const emailField = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a number");

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: emailField,
  password: passwordField,
  businessName: z.string().trim().min(2).max(120).optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
