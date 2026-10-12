# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

A client-only React app that uses an LLM (Gemini, OpenAI or Anthropic, picked per run) to (1) judge a job description against the owner's preferences and (2) rewrite resume sections for that job, then renders the resume as a PDF. There is no backend: the user saves their own API keys in Settings, stored in the browser's IndexedDB, and the browser calls the provider directly. The app is a dashboard (Home, Resume, Settings); the job review and PDF flow is the Resume module. Deployed to GitHub Pages under `/resume-builder/`.

Stack: React 19 (with React Compiler), TypeScript (strict), Vite 7, Tailwind CSS v4, shadcn/ui-style components, Vercel AI SDK v7 (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), `@react-pdf/renderer`, React Router v7 (hash router), Dexie (IndexedDB), react-hook-form + zod. Package manager: **pnpm**.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server |
| `pnpm lint` | ESLint |
| `pnpm test` | Run the Vitest suite once (`pnpm test:watch` to watch, `pnpm coverage` for coverage) |
| `pnpm build` | Type-check (`tsc -b`) and production build |

Before finishing a change, run `pnpm lint`, `pnpm test` and `pnpm build`; all must pass.

## CI/CD

`.github/workflows/ci.yml` runs lint, test and build on every pull request and push. On a push to `main`, a passing build is deployed to GitHub Pages (Pages source: GitHub Actions). There is no manual deploy command: pushing to `main` publishes the live site, so don't push without being asked. Node is pinned in `.nvmrc` and pnpm in `packageManager` in `package.json`; CI installs with `--frozen-lockfile`, so commit `pnpm-lock.yaml` with dependency changes.

## Testing

Vitest + React Testing Library in jsdom (config in `vite.config.ts`). Tests sit next to their file as `*.test.ts(x)`.
- `src/test/setup.ts` loads `fake-indexeddb` (real Dexie in tests) and jest-dom matchers.
- `src/test/utils.tsx`: `resetDb()` for a clean database per test, and `renderWithRouter()` for anything using router hooks (`useBlocker` needs a data router).
- Mock AI calls at the module boundary; never hit a provider. Pages mock `utils/AIHealthCheck`, `AIResumeJudge` and `AIResumeBuilder`. Those modules' own tests mock `ai` (`generateText`, `Output`) and `./aiModel`'s `getModel`; `AIHealthCheck.test.ts` stubs `fetch`. Fake keys live in `src/test/utils.tsx`.
- Mock `@react-pdf/renderer` with `vi.mock("@react-pdf/renderer", () => import("<rel>/test/reactPdfMock"))` so PDF layouts render as DOM.
- `router.tsx` exports `routes` so route tests can use `createMemoryRouter(routes)`.

## Layout

```
src/
  main.tsx              Entry; renders the router
  router.tsx            createHashRouter config; pages are React.lazy
  layouts/DashboardLayout.tsx   Sidebar nav + <Outlet/>
  pages/HomePage.tsx    Dashboard home (placeholder for statistics)
  pages/resume/ResumeGeneratorPage.tsx  The 3-step flow (JD → job review → PDF) and its state
  pages/resume/aiChoice.ts   Remembered key/model choice and default key selection
  pages/resume/JudgeResponse.tsx, Gauge.tsx   Job review view and match-score gauge
  pages/settings/SettingsLayout.tsx     Container + back link for section pages
  pages/settings/SettingsHome.tsx       Tile grid linking to each settings section
  pages/settings/sections.ts            Tile list (id, title, description, icon)
  pages/settings/ApiKeysSection.tsx     Add/edit/delete/default API keys
  pages/settings/ResumeDataSection.tsx  Form over the whole ResumeDataType
  pages/settings/resumeDataSchema.ts    zod schema for that form
  components/form/      TextField, TextAreaField, SelectField, CheckboxField, StringListField
  components/ui/        Button (shadcn-style)
  db/db.ts              Dexie database (apiKeys, resumeData tables) + legacy key migration
  db/apiKeys.ts         Key CRUD and useApiKeys/useProviderKeys hooks
  db/resumeData.ts      save/reset and useResumeData (falls back to the defaults)
  ResumePreview.tsx     PDFViewer wrapper, lazy-loaded by ResumeGeneratorPage
  pdf.tsx               The resume PDF layout (@react-pdf/renderer); takes the resume as a prop
  data/ResumeData.ts    DEFAULT_RESUME_DATA (seed) + toUserData/getTweakableBullets helpers
  types/input.ts        Data types (ResumeDataType, Position, UserData, ...)
  utils/models.ts       Model ids per provider (fast/creative + picker options) — the only place to set them
  utils/providers.ts    AI providers for keys (Gemini, OpenAI, Anthropic), key links and notes
  utils/aiModel.ts      getModel(): builds the AI SDK model for a key — the only importer of @ai-sdk/*
  utils/AIResumeJudge.ts    Job-judging prompt, zod schema and JudgeResponseType
  utils/AIResumeBuilder.ts  Per-section resume generation (summary/experience/skills)
  utils/AIHealthCheck.ts    API key validation (fetch to each provider's models endpoint)
  lib/utils.ts          `cn()` class-name helper
  lib/storage.ts        try/catch localStorage helpers for small preferences
```

## Routing

Hash URLs (`#/`, `#/resume`, `#/settings`, `#/settings/api-keys`, `#/settings/resume-data`) because GitHub Pages can't serve `index.html` for deep links. Add pages to `router.tsx` as `React.lazy` routes. `#/settings` shows a tile grid; each section is its own page. To add one, add a tile to `SETTINGS_SECTIONS` in `pages/settings/sections.ts` and a child route with the same id under `settings` in `router.tsx`.

## Conventions

- **Personal data comes from the DB, not imports.** `DEFAULT_RESUME_DATA` in `src/data/ResumeData.ts` is only the seed; components read the live copy with `useResumeData()` and pass it down (to `pdf.tsx`, `toUserData()`, `judgeJobPosting`). Don't hardcode names, contacts or experience in components or prompts. When changing `ResumeDataType`, update `resumeDataSchema.ts` and the settings form too (the schema `satisfies z.ZodType<ResumeDataType>`).
- **Forms use react-hook-form + zod** via `zodResolver`, with the fields in `components/form/`. String arrays use `StringListField` (`useFieldArray` only handles arrays of objects).
- **New AI providers** need four entries: `PROVIDERS` (`utils/providers.ts`), `MODELS` (`utils/models.ts`), a case in `getModel` (`utils/aiModel.ts`, with its `@ai-sdk/*` package) and a health check in `verifyProviderKey` (`AIHealthCheck.ts`). The provider must accept calls from a browser (CORS). Keys are verified against the provider before they are saved, not by format.
- **Model ids come from `MODELS` in `src/utils/models.ts`.** Don't write model strings inline. AI functions take a `ModelChoice`: `"auto"` maps each task to the provider's `fast` or `creative` model; anything else is a model id from the picker.
- **AI calls use structured output.** Each call uses `generateText` with `Output.object({ schema })` and a zod schema whose fields are all required; the SDK validates the response and throws if it doesn't match. Avoid zod constraints providers may reject in strict schemas (`min`/`max`, regex); describe them instead. When adding a field, update the schema (the types are inferred from it) and the consuming UI together. Pass `temperatureFor(provider, t)`, not a raw temperature.
- **Every AI call in the UI goes through try/catch/finally** that sets an error state and clears the loading flag. Never leave a spinner that can get stuck.
- **Keep `@react-pdf/renderer` out of the main bundle.** Only `pdf.tsx` and `ResumePreview.tsx` may import it, and `ResumePreview` must stay behind `React.lazy`.
- **Use relative imports.** The `@/` alias isn't wired up (see Gotchas).
- Icons: `lucide-react`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `feat!:` for breaking changes).

## Gotchas

- **Never log or commit API keys.** They are user-supplied at runtime and stored unencrypted in IndexedDB. A legacy `localStorage.geminiKey` is moved into the DB when the database is first created. Don't reintroduce `VITE_*` env vars for them: Vite inlines them into the public bundle. Keys stay in the browser by design, even if a backend is added: never send them to our own servers or store them in a remote database. Send keys in headers, never in URLs.
- **Provider quirks.** Anthropic only accepts browser calls with the `anthropic-dangerous-direct-browser-access` header (`ANTHROPIC_BROWSER_HEADER` in `providers.ts`). OpenAI's current models are reasoning models that reject `temperature`, so `temperatureFor` drops it for OpenAI.
- **The AI SDK is large (~180 kB gzipped).** Only `utils/aiModel.ts` imports `@ai-sdk/*`, so the SDK ships only with the Resume page. Don't import `aiModel` from Settings or shared modules.
- **`@/` path alias doesn't work.** In `tsconfig.app.json`, `paths` sits outside `compilerOptions` and Vite has no `resolve.alias`. Files added with the shadcn CLI import from `@/...` and must be rewritten to relative paths (or the alias fixed in both places).
- **`components.json` still says `iconLibrary: "phosphor"`,** but `@phosphor-icons/react` was removed. Components added with the shadcn CLI may import Phosphor; switch them to `lucide-react`.
- **`vite.config.ts` uses `base: '/resume-builder/'`.** Asset paths must work under that prefix.
- **react-hook-form and the React Compiler clash on `reset`.** The compiler memoizes `register()` calls, but react-hook-form forgets its fields on every `reset` (including the `values` prop syncing) and needs them to register again. Components that call `register` on a form using `reset` or `values` must start with `"use no memo";` (see `ResumeDataSection.tsx`). Use the function-level directive; Rollup warns about a module-level one.
- **react-pdf is strict about children:** strings must be inside `<Text>`, and stray whitespace between elements inside a `<View>` causes warnings. Lists need `key`s.
- **Prompt changes affect output quality directly.** Keep the numbered instruction blocks in `AIResumeJudge.ts` / `AIResumeBuilder.ts` coherent, and keep the job description and candidate data inside their XML-style tags.
