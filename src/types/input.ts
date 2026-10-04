import type { JobPreferences } from "../utils/AIResumeJudge";

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

export interface Project {
  projectName: string;
  tasks: string[];
}

export interface Position {
  companyName: string;
  position: string;
  range: string;
  bullets: string[];
  // The AI rewrites this position's bullets for each job
  canTweak?: boolean;
  // Raw project history fed to the AI
  projects?: Project[];
}

export interface ResumeDataType {
  profile: {
    name: string;
    contacts: string[];
    education: { institute: string; degree: string; field: string };
  };
  currentRole: string;
  yearsOfExperience: string;
  requireRemote: boolean;
  summary: string;
  hardSkills: string[];
  // Skills shown in the PDF before generation
  featuredSkills: string[];
  experience: Position[];
  jobPreferences: JobPreferences;
}
