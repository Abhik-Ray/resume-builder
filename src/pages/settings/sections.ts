import { FileUser, KeyRound, type LucideIcon } from "lucide-react";

export interface SettingsSection {
  // Route segment under /settings; add the matching route in router.tsx
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "api-keys",
    title: "API Keys",
    description: "Add and manage the AI provider keys used to review jobs and build resumes.",
    icon: KeyRound,
  },
  {
    id: "resume-data",
    title: "Resume Data",
    description: "Edit your profile, experience, skills and job preferences.",
    icon: FileUser,
  },
];
