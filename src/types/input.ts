export interface JobParams {
    jobDescription: string;
}

export interface WorkHistory {
  companyName: string;
  projectName: string;
  tasks: string[];
}

export interface UserData {
  currentRole: string;
  yearsOfExperience: string;
  requireRemote: boolean;
  rawWorkHistory: WorkHistory[];
  hardSkills: string[];
}