export type SearchSourceName = "adzuna" | "jooble" | "jsearch";
export type BoardProvider = "greenhouse" | "lever";
export type SourceName = SearchSourceName | BoardProvider;

// A posting as every source returns it
export interface NormalizedJob {
  source: SourceName;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  postedAt: string | null;
}

// One API search, shared by every user whose saved search maps to it
export interface SearchQuery {
  keywords: string[];
  // ISO 3166-1 alpha-2, upper case
  country: string;
  // null for remote searches
  city: string | null;
  region: string | null;
  radiusKm: number;
  remote: boolean;
}

export interface JobSource {
  name: SearchSourceName;
  searchJobs(query: SearchQuery): Promise<NormalizedJob[]>;
}

// A company's public job board (the optional watch list): every open posting, no query
export interface BoardSource {
  name: BoardProvider;
  listJobs(board: string): Promise<NormalizedJob[]>;
}

// A board and the users watching it
export interface WatchedBoard {
  provider: BoardProvider;
  board: string;
  name: string;
  userIds: string[];
}

// A user's active saved search with its location resolved from the profile
export interface UserSearch {
  userId: string;
  searchProfileId: string;
  keywords: string[];
  excludeKeywords: string[];
  minScore: number;
  remoteOnly: boolean;
  includeRemote: boolean;
  country: string;
  city: string;
  region: string | null;
  radiusKm: number;
}

export const USER_AGENT = "resume-builder-job-sync (+https://github.com/Abhik-Ray/resume-builder)";

// A source failure with the response body left out (it can echo request parameters)
export class SourceError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SourceError";
    this.status = status;
  }
}

export type Fetch = typeof fetch;
