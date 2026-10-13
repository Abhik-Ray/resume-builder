// In-memory stand-in for lib/supabase.ts, installed for every test by test/setup.ts.
// It covers the query-builder calls the app makes and enforces "own rows only" the way RLS
// does, so tests exercise the real data-access code without a network.
import type { Session } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type Result = { data: unknown; error: FakePostgrestError | null };

// Like supabase-js's PostgrestError, which extends Error
class FakePostgrestError extends Error {
  code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}
type AuthListener = (event: string, session: Session | null) => void;

export const TEST_USER = { id: "00000000-0000-4000-8000-000000000001", email: "user@example.com" };

const tables = new Map<string, Row[]>();
const failures = new Map<string, string>();
const listeners = new Set<AuthListener>();
let session: Session | null = null;
// Columns that identify a table's rows for upserts
const primaryKeys: Record<string, string[]> = {
  profiles: ["user_id"],
  job_matches: ["user_id", "job_id"],
};
// Column defaults applied on insert, mirroring the migrations
const defaults: Record<string, () => Row> = {
  profiles: () => ({
    resume_data: null,
    home_city: null,
    home_region: null,
    home_country: null,
    search_radius_km: 50,
    include_remote: true,
    details_completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  search_profiles: () => ({
    user_id: session?.user.id,
    exclude_keywords: [],
    location_override: null,
    remote_only: false,
    min_score: 3,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  job_matches: () => ({
    search_profile_id: null,
    keyword_score: 3,
    verdict: null,
    state: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  applications: () => ({
    user_id: session?.user.id,
    job_id: null,
    url: null,
    jd_text: null,
    resume_snapshot: null,
    status: "saved",
    applied_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
};

// Foreign keys declared on delete cascade: parent table -> [child table, column]
const cascades: Record<string, [string, string][]> = {
  applications: [["application_events", "application_id"]],
};

// The database triggers the app relies on, run after each insert or update
const triggers: Record<string, (row: Row, previous: Row | undefined) => void> = {
  applications(row, previous) {
    if (row.applied_at == null && row.status !== "saved") row.applied_at = new Date().toISOString();
    if (previous && previous.status === row.status) return;
    table("application_events").push({
      id: table("application_events").length + 1,
      application_id: row.id,
      user_id: row.user_id,
      from_status: previous ? previous.status : null,
      to_status: row.status,
      at: new Date().toISOString(),
      note: null,
    });
  },
};

const makeSession = (user = TEST_USER): Session =>
  ({
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: user.id, email: user.email, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" },
  }) as Session;

const emit = (event: string) => listeners.forEach((listener) => listener(event, session));

const table = (name: string) => {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name)!;
};

// Rows the signed-in user may see: like RLS, user-owned tables only show their own rows
const visible = (row: Row) => !("user_id" in row) || row.user_id === session?.user.id;

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] | Row = [];
  private mode: "many" | "single" | "maybeSingle" = "many";
  private sort: { column: string; ascending: boolean }[] = [];
  private max: number | undefined;

  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  select() {
    return this;
  }
  insert(rows: Row | Row[]) {
    this.operation = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: Row | Row[]) {
    this.operation = "upsert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.operation = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  gte(column: string, value: string | number) {
    this.filters.push((row) => (row[column] as string | number) >= value);
    return this;
  }
  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.sort.push({ column, ascending });
    return this;
  }
  limit(count: number) {
    this.max = count;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(onFulfilled, onRejected);
  }

  private run(): Result {
    const failure = failures.get(this.name);
    if (failure) {
      failures.delete(this.name);
      return { data: null, error: new FakePostgrestError(failure) };
    }
    if (!session) return { data: null, error: new FakePostgrestError("JWT required", "42501") };
    const rows = table(this.name);
    const matches = () => rows.filter((row) => visible(row) && this.filters.every((f) => f(row)));
    let result: Row[];

    switch (this.operation) {
      case "select":
        result = matches();
        break;
      case "insert":
      case "upsert": {
        const keys = primaryKeys[this.name] ?? ["id"];
        result = [];
        for (const input of [this.payload].flat() as Row[]) {
          if ("user_id" in input && input.user_id !== session.user.id) {
            return { data: null, error: new FakePostgrestError("new row violates row-level security policy", "42501") };
          }
          const existing = rows.find((row) => keys.every((k) => k in input && row[k] === input[k]));
          if (existing && this.operation === "insert") {
            return { data: null, error: new FakePostgrestError("duplicate key value", "23505") };
          }
          if (existing) {
            const previous = { ...existing };
            Object.assign(existing, input);
            triggers[this.name]?.(existing, previous);
            result.push(existing);
          } else {
            const row = { id: crypto.randomUUID(), ...defaults[this.name]?.(), ...input };
            rows.push(row);
            triggers[this.name]?.(row, undefined);
            result.push(row);
          }
        }
        break;
      }
      case "update":
        result = matches();
        result.forEach((row) => {
          const previous = { ...row };
          Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
          triggers[this.name]?.(row, previous);
        });
        break;
      case "delete":
        result = matches();
        tables.set(this.name, rows.filter((row) => !result.includes(row)));
        // on delete cascade
        for (const [child, column] of cascades[this.name] ?? []) {
          const ids = result.map((row) => row.id);
          tables.set(child, table(child).filter((row) => !ids.includes(row[column])));
        }
        break;
    }

    for (const { column, ascending } of [...this.sort].reverse()) {
      result = [...result].sort((a, b) => {
        const [x, y] = [a[column] as string | number, b[column] as string | number];
        return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
      });
    }
    if (this.max !== undefined) result = result.slice(0, this.max);
    const data = structuredClone(result);

    if (this.mode === "many") return { data, error: null };
    if (data.length > 1) return { data: null, error: new FakePostgrestError("multiple rows returned", "PGRST116") };
    if (data.length === 0 && this.mode === "single") {
      return { data: null, error: new FakePostgrestError("no rows returned", "PGRST116") };
    }
    return { data: data[0] ?? null, error: null };
  }
}

export const supabase = {
  from: (name: string) => new Query(name),
  rpc: (name: string) => new Query(`rpc:${name}`),
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (listener: AuthListener) => {
      listeners.add(listener);
      queueMicrotask(() => listener("INITIAL_SESSION", session));
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    signInWithOAuth: async () => ({ data: {}, error: null }),
    signOut: async () => {
      session = null;
      emit("SIGNED_OUT");
      return { error: null };
    },
  },
};

export const isSupabaseConfigured = true;
export const getSupabase = () => supabase;

// Test controls
export const fakeSupabase = {
  reset({ signedIn = true } = {}) {
    tables.clear();
    failures.clear();
    listeners.clear();
    session = signedIn ? makeSession() : null;
  },
  signIn(user = TEST_USER) {
    session = makeSession(user);
    emit("SIGNED_IN");
  },
  signOut() {
    session = null;
    emit("SIGNED_OUT");
  },
  // Rows of a table, including other users' (what the service role would see)
  rows: (name: string) => structuredClone(table(name)),
  // Inserts rows, replacing any with the same primary key
  seed(name: string, rows: Row[]) {
    const keys = primaryKeys[name] ?? ["id"];
    for (const row of structuredClone(rows)) {
      const kept = table(name).filter((r) => !keys.every((k) => k in row && r[k] === row[k]));
      tables.set(name, [...kept, { id: crypto.randomUUID(), ...defaults[name]?.(), ...row }]);
    }
  },
  // The next request to `name` fails with `message`
  failNext(name: string, message: string) {
    failures.set(name, message);
  },
};
