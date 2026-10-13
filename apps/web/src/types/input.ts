export type { JobPreferences, Position, Project, ResumeDataType } from "@resume-builder/shared";

export interface WorkHistory {
  companyName: string;
  projectName: string;
  tasks: string[];
}

// Shape sent to the AI as candidate data
export interface UserData {
  currentRole: string;
  yearsOfExperience: string;
  requireRemote: boolean;
  rawWorkHistory: WorkHistory[];
  hardSkills: string[];
}
