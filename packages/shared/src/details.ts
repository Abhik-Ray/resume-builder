import { z } from "zod";
import type { ResumeDataType } from "./resumeData";
import { resumeDataSchema, toFormValues } from "./resumeDataSchema";
import type { ProfileRow } from "./detailsCheck";

// Defaults for a new profile (they match the column defaults in the profiles migration)
export const DEFAULT_SEARCH_RADIUS_KM = 50;
export const DEFAULT_INCLUDE_REMOTE = true;

export const homeLocationSchema = z.object({
  city: z.string().trim().min(1, "City is required").max(100, "At most 100 characters"),
  region: z.string().trim().max(100, "At most 100 characters"),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use the two-letter country code, e.g. IN"),
  // Registered with valueAsNumber, so an empty input arrives as NaN
  searchRadiusKm: z
    .number("Enter a number")
    .int("Use whole kilometres")
    .min(1, "At least 1 km")
    .max(500, "At most 500 km"),
  includeRemote: z.boolean(),
});

export type HomeLocation = z.output<typeof homeLocationSchema>;

// The Details page: the resume data plus the home location used by job search
export const detailsSchema = resumeDataSchema.extend({ home: homeLocationSchema });

export type DetailsFormValues = z.input<typeof detailsSchema>;
export type Details = z.output<typeof detailsSchema>;

export const toDetailsFormValues = (
  data: ResumeDataType,
  profile: Pick<
    ProfileRow,
    "home_city" | "home_region" | "home_country" | "search_radius_km" | "include_remote"
  > | null,
): DetailsFormValues => ({
  ...toFormValues(data),
  home: {
    city: profile?.home_city ?? "",
    region: profile?.home_region ?? "",
    country: profile?.home_country ?? "",
    searchRadiusKm: profile?.search_radius_km ?? DEFAULT_SEARCH_RADIUS_KM,
    includeRemote: profile?.include_remote ?? DEFAULT_INCLUDE_REMOTE,
  },
});
