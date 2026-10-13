# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

A React app that uses an LLM (Gemini, OpenAI or Anthropic, picked per run) to (1) judge a job description against the user's preferences and (2) rewrite resume sections for that job, then renders the resume as a PDF. Users sign in with Google through Supabase Auth; their details live in Supabase Postgres, isolated per user by Row Level Security. There is no server of our own: the browser talks to Supabase with the user's token. AI keys never leave the browser: the user saves them in Settings, stored in IndexedDB, and the browser calls the provider directly. The app is a dashboard (Home, Jobs, Resume, Applications, Stats, Settings); the job review and PDF flow is the Resume module, Applications/Stats are the tracker, and Jobs is the inbox the daily job sync fills. Deployed to GitHub Pages under `/resume-builder/`. The plan for the backend is in issues #2–#6.

Stack: React 19 (with React Compiler), TypeScript (strict), Vite 7, Tailwind CSS v4, shadcn/ui-style components, Vercel AI SDK v7 (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), `@react-pdf/renderer`, React Router v7 (hash router), Dexie (IndexedDB, for API keys), Supabase (`@supabase/supabase-js`, Postgres, Auth), TanStack Query, react-hook-form + zod. Package manager: **pnpm**.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies for the whole workspace |
| `pnpm dev` | Web dev server (`pnpm --filter @resume-builder/web dev`) |
| `pnpm lint` | ESLint over the whole repo (one config at the root) |
| `pnpm test` | Run every package's tests once (`pnpm test:watch` to watch, `pnpm coverage` for coverage) |
| `pnpm build` | Type-check and build every package (`pnpm -r build`) |
| `pnpm supabase start` | Local Supabase in Docker (prints URLs and keys); `pnpm supabase db start` for Postgres only |
| `pnpm supabase test db` | pgTAP tests in `supabase/tests/database` |
| `pnpm db:types` | Regenerate `packages/shared/src/database.ts` from the local database |

Run commands from the repo root. Before finishing a change, run `pnpm lint`, `pnpm test` and `pnpm build`; all must pass.

## Monorepo

A pnpm workspace (`pnpm-workspace.yaml`); no Turborepo or Nx, `pnpm -r` and `--filter` are enough.

| Package | Path | What it is |
| --- | --- | --- |
| `@resume-builder/web` | `apps/web` | The React app (everything under Layout below) |
| `@resume-builder/job-sync` | `apps/job-sync` | The daily job sync (Node 22 + tsx), run by `.github/workflows/job-sync.yml` |
| `@resume-builder/ai` | `packages/ai` | Model ids, `getModel` and the job judge, shared by the web app and the job sync's owner auto-judging. Imported by subpath (`/providers`, `/models`, `/model`, `/judge`) |
| `@resume-builder/shared` | `packages/shared` | Types and zod schemas shared across apps, plus the generated database types |
| (Supabase project) | `supabase/` | `config.toml`, SQL migrations, pgTAP tests |

- Internal packages are consumed as TypeScript source: `exports` points at `src/index.ts`, so Vite and tsx compile it with no build step (`build` only type-checks). Depend on one with `"workspace:*"`.
- `packages/shared` stays environment-neutral: plain TypeScript and zod, no DOM or Node APIs (its `tsconfig.json` has neither lib).
- `packages/shared` has `"sideEffects": false` so unused exports drop out of bundles. Code the main bundle needs (like `detailsCheck.ts`, used by the sign-in guard) must not import zod.
- There is one lockfile and one `eslint.config.js`, both at the root. Lint tooling is a root devDependency; add app dependencies to the app with `pnpm --filter <name> add <pkg>`.

## CI/CD

`.github/workflows/ci.yml` runs lint, test and build on every pull request and push, and a `database` job that starts a local Supabase (every migration from scratch), runs the pgTAP tests and `supabase db lint`, and fails if `packages/shared/src/database.ts` is stale. `.github/workflows/job-sync.yml` runs the job sync daily at 00:30 UTC (06:00 IST) and on manual dispatch, with `SUPABASE_URL` (variable), `SUPABASE_SERVICE_ROLE_KEY` and each source's key (secrets; sources without one are skipped). On a push to `main`, the `migrate` job runs `supabase db push` against the hosted project, then a passing build (`apps/web/dist`) is deployed to GitHub Pages (Pages source: GitHub Actions). Migrations go first, so they must stay compatible with the deployed app: add columns; never rename or drop one in the same release. The build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Actions variables; `migrate` needs the `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID` secrets. There is no manual deploy command: pushing to `main` publishes the live site, so don't push without being asked. Node is pinned in `.nvmrc` and pnpm in `packageManager` in the root `package.json`; CI installs with `--frozen-lockfile`, so commit `pnpm-lock.yaml` with dependency changes.

## Testing

Vitest + React Testing Library in jsdom (config in `apps/web/vite.config.ts`). Paths below are relative to `apps/web/`. Tests sit next to their file as `*.test.ts(x)`.
- `src/test/setup.ts` loads `fake-indexeddb` (real Dexie in tests) and jest-dom matchers, and replaces `lib/supabase.ts` with `test/fakeSupabase.ts`: an in-memory query builder that shows only the signed-in user's rows (like RLS). Every test starts signed in with no rows; `fakeSupabase.reset({ signedIn: false })`, `.seed()`, `.rows()` and `.failNext(table, message)` control it. Extend the fake when the app uses a new query-builder method.
- `src/test/utils.tsx`: `resetDb()` for a clean IndexedDB per test; `renderWithRouter()` renders a page in a data router behind `RequireAuth` with the app's providers (it skips the post-sign-in details redirect unless `detailsPrompt: true`); `seedProfile()` gives the test user a complete profile.
- Pages render after the session loads, so wait with `findBy…` before the first assertion.
- Mock AI calls at the module boundary; never hit a provider. Pages mock `utils/AIHealthCheck`, `AIResumeJudge`, `AIResumeBuilder` and `providerModels`. Those modules' own tests (the judge's are in `packages/ai`) mock `ai` (`generateText`, `Output`) and `./aiModel`'s `getModel`; `AIHealthCheck.test.ts` and `providerModels.test.ts` stub `fetch`. Fake keys live in `src/test/utils.tsx`.
- Mock `@react-pdf/renderer` with `vi.mock("@react-pdf/renderer", () => import("<rel>/test/reactPdfMock"))` so PDF layouts render as DOM.
- `router.tsx` exports `routes` so route tests can use `createMemoryRouter(routes)`.

## Layout

```
apps/web/src/
  main.tsx              Entry; renders the router
  router.tsx            createHashRouter config; pages are React.lazy; #/login is public, the rest sits behind RequireAuth
  auth/AppProviders.tsx QueryClient + AuthProvider (the root route)
  auth/AuthProvider.tsx, session.ts   Supabase session context, useAuth/useUserId, details-prompt flag
  auth/RequireAuth.tsx  Route guard; opens Details once per sign-in when details are missing
  auth/actions.ts       signInWithGoogle / signOut
  lib/supabase.ts       getSupabase(): the Supabase client (PKCE), created on first use
  pages/login/LoginPage.tsx   "Continue with Google"
  layouts/DashboardLayout.tsx   Sidebar nav + <Outlet/>
  pages/HomePage.tsx    Dashboard home: stat tiles from the tracker and today's matches
  pages/jobs/JobsPage.tsx   Matches inbox: tabs by state, judge new matches in the browser, generate a resume, mark applied
  pages/jobs/judging.ts     judgeInBatches (a few at a time, failures collected)
  pages/settings/JobSearchesSection.tsx   Saved searches (keywords, excludes, city, remote only, min score); WatchedCompanies.tsx for Greenhouse/Lever boards
  pages/applications/ApplicationsPage.tsx   Tracker: table or kanban board (ApplicationsBoard.tsx, drag or dropdown), delete, resume sent; ApplicationForm.tsx is shared with the Resume flow
  pages/stats/StatsPage.tsx   Stat tiles, funnel and weekly charts, status changes; weeks.ts fills empty weeks
  components/charts/    HTML bar/column charts (tooltip + table view), StatTile, number formats
  pages/resume/ResumeGeneratorPage.tsx  The 3-step flow (JD → job review → PDF) and its state
  pages/resume/aiChoice.ts   Remembered key/model choice and default key selection
  pages/resume/JudgeResponse.tsx, Gauge.tsx   Job review view and match-score gauge
  pages/settings/SettingsLayout.tsx     Container + back link for section pages
  pages/settings/SettingsHome.tsx       Tile grid linking to each settings section
  pages/settings/sections.ts            Tile list (id, title, description, icon)
  pages/settings/ApiKeysSection.tsx     Add/edit/delete/default API keys
  pages/settings/ResumeDataSection.tsx  Details page: form over ResumeDataType + home location, saved to profiles
  components/form/      TextField, TextAreaField, SelectField, CheckboxField, StringListField
  components/ui/        Button (shadcn-style)
  db/db.ts              Dexie database (apiKeys; resumeData is legacy, imported into a new profile) + legacy key migration
  db/apiKeys.ts         Key CRUD and useApiKeys/useProviderKeys hooks
  db/profile.ts         profiles table: fetch (creates on first sign-in), update, useProfile/useUpdateProfile
  db/resumeData.ts      resumeFromProfile and useResumeData (falls back to the defaults)
  db/applications.ts    applications CRUD + hooks; mutations refresh the list and the stats
  db/stats.ts           Reads the stats views
  db/matches.ts         job_matches + their jobs, triage/verdict updates, latest sync run
  db/searchProfiles.ts  search_profiles CRUD + hooks
  db/watchedCompanies.ts   watched_companies CRUD + hooks
  ResumePreview.tsx     PDFViewer wrapper, lazy-loaded by ResumeGeneratorPage
  pdf.tsx               The resume PDF layout (@react-pdf/renderer); takes the resume as a prop
  data/ResumeData.ts    DEFAULT_RESUME_DATA (seed) + toUserData/getTweakableBullets helpers
  types/input.ts        UserData/WorkHistory, and re-exports of the shared resume types
  utils/models.ts, aiModel.ts, AIResumeJudge.ts   Re-exports of @resume-builder/ai (tests and pages mock these paths)
  utils/providers.ts    AI providers for keys (Gemini, OpenAI, Anthropic), key links and notes
  utils/providerModels.ts   The models a key can use, from the provider's list (merged into the Resume picker)
  utils/AIResumeBuilder.ts  Per-section resume generation (summary/experience/skills)
  utils/AIHealthCheck.ts    API key validation (fetch to each provider's models endpoint)
  lib/utils.ts          `cn()` class-name helper
  lib/storage.ts        try/catch localStorage helpers for small preferences

packages/shared/src/
  index.ts              Package entry; re-exports everything below
  resumeData.ts         ResumeDataType, Position, Project, JobPreferences, WORK_MODELS
  resumeDataSchema.ts   zod schema for ResumeDataType (used by the settings form) + toFormValues
  details.ts            Details form schema (resume data + home location) and its form values
  detailsCheck.ts       missingDetails/isDetailsComplete (zod-free) and ProfileRow
  applications.ts       APPLICATION_STATUSES (mirrors the enum, in order), labels, ResumeSnapshot, form schema
  jobs.ts               Job/match/search types, MATCH_STATES, keyword scores, saved-search and watch-list schemas, jobPostingText

packages/ai/src/
  providers.ts          PROVIDER_IDS, ProviderId, ANTHROPIC_BROWSER_HEADER
  models.ts             Model ids per provider (fast/creative + picker options) — the only place to set them
  aiModel.ts            getModel(): builds the AI SDK model for a key — the only importer of @ai-sdk/*
  AIResumeJudge.ts      Job-judging prompt, zod schema and JudgeResponseType

apps/job-sync/src/
  index.ts              Entry: env, Supabase service-role client, runSync, exit code
  pipeline.ts           runSync and the SyncStore interface; store.ts is the Supabase version
  query.ts              planQueries: one shared query per unique (keywords, location)
  match.ts              scoreJob/matchesSearch (deterministic) and dedupeJobs
  sources/              adzuna, jooble, jsearch: searchJobs(query); greenhouse, lever: listJobs(board) for watched companies; http.ts validates responses
  autoJudge.ts          Optional owner auto-judging (OWNER_USER_ID, OWNER_AI_PROVIDER, OWNER_AI_API_KEY)
  fixtures/             Recorded responses for the source tests
  database.ts           Generated by `pnpm db:types`; don't edit

supabase/
  config.toml           Local stack config; Google is the only auth provider
  migrations/           SQL migrations (schema, RLS policies, grants)
  tests/database/       pgTAP tests (00_anon checks anon can reach nothing)
```

## Routing

Hash URLs (`#/login`, `#/`, `#/jobs`, `#/resume`, `#/applications`, `#/stats`, `#/settings`, `#/settings/searches`, `#/settings/api-keys`, `#/settings/resume-data`) because GitHub Pages can't serve `index.html` for deep links. Add pages to `router.tsx` as `React.lazy` routes. `#/settings` shows a tile grid; each section is its own page. To add one, add a tile to `SETTINGS_SECTIONS` in `pages/settings/sections.ts` and a child route with the same id under `settings` in `router.tsx`.

## Conventions

- **Personal data comes from the DB, not imports.** Each user's resume data and home location live in their `profiles` row. `DEFAULT_RESUME_DATA` in `apps/web/src/data/ResumeData.ts` is only the fallback until they save their own; components read the live copy with `useProfile()` / `useResumeData()` and pass it down (to `pdf.tsx`, `toUserData()`, `judgeJobPosting`). Don't hardcode names, contacts or experience in components or prompts. When changing `ResumeDataType` (in `packages/shared`), update `resumeDataSchema.ts` next to it and the settings form too (the schema `satisfies z.ZodType<ResumeDataType>`).
- **Forms use react-hook-form + zod** via `zodResolver`, with the fields in `components/form/`. String arrays use `StringListField` (`useFieldArray` only handles arrays of objects).
- **New AI providers** need these entries: `PROVIDER_IDS` (`packages/ai/src/providers.ts`), `PROVIDERS` (`apps/web/src/utils/providers.ts`), `MODELS` (`packages/ai/src/models.ts`), a case in `getModel` (`packages/ai/src/aiModel.ts`, with its `@ai-sdk/*` package), a health check in `verifyProviderKey` (`AIHealthCheck.ts`) and a model list in `listProviderModels` (`providerModels.ts`). The provider must accept calls from a browser (CORS). Keys are verified against the provider before they are saved, not by format.
- **Model ids come from `MODELS` in `packages/ai/src/models.ts`.** Don't write model strings inline. The Resume picker adds the key's own models from the provider's list; `MODELS` stays the curated default. AI functions take a `ModelChoice`: `"auto"` maps each task to the provider's `fast` or `creative` model; anything else is a model id from the picker.
- **AI calls use structured output.** Each call uses `generateText` with `Output.object({ schema })` and a zod schema whose fields are all required; the SDK validates the response and throws if it doesn't match. Avoid zod constraints providers may reject in strict schemas (`min`/`max`, regex); describe them instead. When adding a field, update the schema (the types are inferred from it) and the consuming UI together. Pass `temperatureFor(provider, t)`, not a raw temperature.
- **Every AI and Supabase call in the UI goes through try/catch/finally** (or a query's error state) that sets an error message and clears the loading flag. Never leave a spinner that can get stuck.
- **Database changes are migrations** in `supabase/migrations` (`pnpm supabase migration new <name>`). Every table gets RLS with policies `to authenticated` only; user-owned tables have `user_id references auth.users on delete cascade` and `(select auth.uid()) = user_id` policies. Never grant anything to `anon` (the first migration revokes its defaults and `00_anon.test.sql` checks it). Views use `with (security_invoker = true)`. Add pgTAP tests for new policies, then run `pnpm db:types` and update the fake's defaults if the table is new.
- **Keep `@react-pdf/renderer` out of the main bundle.** Only `pdf.tsx` and `ResumePreview.tsx` may import it, and `ResumePreview` must stay behind `React.lazy`.
- **Use relative imports.** The `@/` alias isn't wired up (see Gotchas).
- **Application status changes are recorded by the database.** The UI only updates `applications.status`; a trigger writes `application_events` (users can't insert them) and sets `applied_at`. The stats views read the events. The status enum's declaration order is the funnel order; if you add a status, update `APPLICATION_STATUSES` too (a test checks they match).
- **The job sync only calls official job-search APIs** (no scraping) and judges nothing: AI keys never leave the browser, so matches are judged on the Jobs page with the user's own key. Each source validates its response with zod and throws `SourceError` (never include request URLs or bodies in messages: some providers put the key in the URL). A failing source lands in `sync_runs.errors` and the others continue. Postings no working source has listed for 30 days get `closed_at` ("no longer listed", not proven closed) and lose their description after 90 days; a posting that comes back reopens. Owner auto-judging is off unless its three settings exist, never fails the run, and logs error messages only (Actions logs are public). Users can read jobs, matches and runs but only change a match's `state` and `verdict` (column grant); everything else is written by the service role. Job-sync tests use recorded fixtures and an in-memory `SyncStore`; never hit a real API.
- **Charts** are plain HTML in `components/charts` with the `--viz-series` color token (light and dark validated with the dataviz skill). Every chart has hover/focus tooltips and a "Show as table" view; text uses text colors, never the series color.
- Icons: `lucide-react`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `feat!:` for breaking changes).

## Gotchas

- **Supabase keys:** the publishable key and project URL are public by design and ship in the bundle (`VITE_SUPABASE_*`). The service-role key bypasses RLS: it lives only in Actions secrets for server-side jobs and must never reach the web app.
- **Never log or commit API keys.** They are user-supplied at runtime and stored unencrypted in IndexedDB. A legacy `localStorage.geminiKey` is moved into the DB when the database is first created. Don't add `VITE_*` env vars for AI keys: Vite inlines them into the public bundle. Keys stay in the browser by design, even if a backend is added: never send them to our own servers or store them in a remote database. Send keys in headers, never in URLs.
- **Provider quirks.** Anthropic only accepts browser calls with the `anthropic-dangerous-direct-browser-access` header (`ANTHROPIC_BROWSER_HEADER` in `providers.ts`). OpenAI's current models are reasoning models that reject `temperature`, so `temperatureFor` drops it for OpenAI.
- **The AI SDK is large (~180 kB gzipped).** Only `packages/ai/src/aiModel.ts` imports `@ai-sdk/*`, so the SDK ships only with the Resume and Jobs pages. Import `@resume-builder/ai` by subpath, and never `/model` or `/judge` from Settings or other shared modules (`/providers` and `/models` are SDK-free).
- **`@/` path alias doesn't work.** In `apps/web/tsconfig.app.json`, `paths` sits outside `compilerOptions` and Vite has no `resolve.alias`. Run the shadcn CLI from `apps/web`; files it adds import from `@/...` and must be rewritten to relative paths (or the alias fixed in both places).
- **`apps/web/components.json` still says `iconLibrary: "phosphor"`,** but `@phosphor-icons/react` was removed. Components added with the shadcn CLI may import Phosphor; switch them to `lucide-react`.
- **`apps/web/vite.config.ts` uses `base: '/resume-builder/'`.** Asset paths must work under that prefix.
- **react-hook-form and the React Compiler clash on `reset`.** The compiler memoizes `register()` calls, but react-hook-form forgets its fields on every `reset` (including the `values` prop syncing) and needs them to register again. Components that call `register` on a form using `reset` or `values` must start with `"use no memo";` (see `ResumeDataSection.tsx`). Use the function-level directive; Rollup warns about a module-level one.
- **react-pdf is strict about children:** strings must be inside `<Text>`, and stray whitespace between elements inside a `<View>` causes warnings. Lists need `key`s.
- **Prompt changes affect output quality directly.** Keep the numbered instruction blocks in `AIResumeJudge.ts` / `AIResumeBuilder.ts` coherent, and keep the job description and candidate data inside their XML-style tags.
