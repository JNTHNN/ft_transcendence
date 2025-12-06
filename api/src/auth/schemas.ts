import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().min(2).max(25)
});

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200)
});