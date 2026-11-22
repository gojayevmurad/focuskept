// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const SUPPORT_CATEGORIES = [
  "question",
  "bug",
  "billing",
  "account",
  "safety",
  "privacy",
  "legal",
  "feedback",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const supportTicketSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  category: z.enum(SUPPORT_CATEGORIES),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(200),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000),
  locale: z.string().max(10).default("en"),
  pageUrl: z.string().max(1000).default(""),
  // Honeypot field: must be empty for human submissions
  hp: z.string().max(100).optional(),
});

export type SupportTicketInput = z.infer<typeof supportTicketSchema>;
