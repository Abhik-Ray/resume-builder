import { z } from "zod";
import type { Database } from "./database";
import type { ResumeDataType } from "./resumeData";

export type ApplicationStatus = Database["public"]["Enums"]["application_status"];
export type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
export type ApplicationEventRow = Database["public"]["Tables"]["application_events"]["Row"];

// Mirrors the application_status enum, in its declaration order (the forward path, then exits)
export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
] as const satisfies readonly ApplicationStatus[];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

// Still in play: not accepted and not one of the exits
export const isActiveStatus = (status: ApplicationStatus) =>
  !["accepted", "rejected", "withdrawn", "ghosted"].includes(status);

// The resume exactly as sent, enough to rebuild the PDF
export interface ResumeSnapshot {
  resume: ResumeDataType;
  summary: string;
  skills: string[];
  experienceBullets: string[];
}

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || z.url().safeParse(value).success, "Enter a full URL")
  .transform((value) => value || null);

// The form for adding an application by hand or from the Resume flow
export const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(150, "At most 150 characters"),
  title: z.string().trim().min(1, "Job title is required").max(150, "At most 150 characters"),
  url: optionalUrl,
  status: z.enum(APPLICATION_STATUSES),
});

export type ApplicationInput = z.output<typeof applicationInputSchema>;
export type ApplicationFormValues = z.input<typeof applicationInputSchema>;
