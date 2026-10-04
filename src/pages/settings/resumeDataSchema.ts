import { z } from "zod";
import type { ResumeDataType } from "../../types/input";

const requiredText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

// Non-empty items, at least `min` of them, no case-insensitive duplicates
const textList = (label: string, { min = 1, max = 200 } = {}) =>
  z
    .array(requiredText(label, max))
    .min(min, `Add at least ${min} ${label.toLowerCase()}`)
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        const normalized = item.trim().toLowerCase();
        if (normalized && seen.has(normalized)) {
          ctx.addIssue({ code: "custom", message: "Duplicate entry", path: [index] });
        }
        seen.add(normalized);
      });
    });

// Contacts are free text, but anything that looks like a URL, email or phone must be valid
const contact = requiredText("Contact").superRefine((value, ctx) => {
  if (/^https?:\/\//i.test(value)) {
    if (!z.url().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Invalid URL" });
    }
  } else if (value.includes("@")) {
    if (!z.email().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Invalid email address" });
    }
  } else if (/^\+?[\d\s()-]+$/.test(value)) {
    const digits = value.replace(/\D/g, "").length;
    if (digits < 7 || digits > 15) {
      ctx.addIssue({ code: "custom", message: "Phone numbers need 7–15 digits" });
    }
  }
});

const project = z.object({
  projectName: requiredText("Project name", 100),
  tasks: textList("Task", { max: 500 }),
});

const position = z.object({
  companyName: requiredText("Company name", 100),
  position: requiredText("Position", 100),
  range: requiredText("Date range", 50),
  bullets: textList("Bullet", { max: 600 }),
  canTweak: z.boolean().optional(),
  projects: z.array(project).optional(),
});

export const WORK_MODELS = ["Remote", "Hybrid", "On-site", "Any"] as const;

export const resumeDataSchema = z.object({
  profile: z.object({
    name: requiredText("Name", 100),
    contacts: z
      .array(contact)
      .min(1, "Add at least one contact")
      .max(8, "At most 8 contacts fit in the PDF header"),
    education: z.object({
      institute: requiredText("Institute", 150),
      degree: requiredText("Degree", 150),
      field: requiredText("Field", 150),
    }),
  }),
  currentRole: requiredText("Current role", 100),
  yearsOfExperience: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter a number such as 3 or 3.5")
    // zod still runs this when the regex fails; NaN passes so only the format error shows
    .refine((v) => !(Number(v) > 60), "Must be 60 or less"),
  requireRemote: z.boolean(),
  summary: requiredText("Summary", 1000),
  hardSkills: textList("Skill", { max: 60 }),
  featuredSkills: textList("Skill", { max: 60 }),
  experience: z
    .array(position)
    .min(1, "Add at least one position")
    .superRefine((positions, ctx) => {
      // The AI rewrites the bullets of a single position
      let tweakableSeen = false;
      positions.forEach((p, index) => {
        if (!p.canTweak) return;
        if (tweakableSeen) {
          ctx.addIssue({
            code: "custom",
            message: "Only one position can be rewritten by the AI",
            path: [index, "canTweak"],
          });
        }
        tweakableSeen = true;
      });
    }),
  jobPreferences: z.object({
    desiredRoles: textList("Role", { max: 100 }),
    targetSalary: z.string().trim().max(100, "At most 100 characters").optional(),
    preferredWorkModel: z.enum(WORK_MODELS),
    coreTechStack: textList("Technology", { max: 60 }),
    dealBreakers: textList("Deal breaker", { min: 0, max: 150 }),
    careerGoals: requiredText("Career goals", 500),
  }),
}) satisfies z.ZodType<ResumeDataType>;

export type ResumeFormValues = z.input<typeof resumeDataSchema>;

// Fill optional fields so every input is controlled
export const toFormValues = (data: ResumeDataType): ResumeFormValues => ({
  ...data,
  experience: data.experience.map((p) => ({
    ...p,
    canTweak: p.canTweak ?? false,
    projects: p.projects ?? [],
  })),
  jobPreferences: {
    ...data.jobPreferences,
    targetSalary: data.jobPreferences.targetSalary ?? "",
  },
});
