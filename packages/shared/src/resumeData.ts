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

export const WORK_MODELS = ["Remote", "Hybrid", "On-site", "Any"] as const;

export interface JobPreferences {
  desiredRoles: string[];
  targetSalary?: string;
  preferredWorkModel: (typeof WORK_MODELS)[number];
  coreTechStack: string[];
  dealBreakers: string[]; // e.g., "Weekend work", "Legacy codebase"
  careerGoals: string; // e.g., "Looking for mentorship", "Want to lead a team"
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
