# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

A client-only React app that uses Google Gemini to (1) judge a job description against the owner's preferences and (2) rewrite resume sections for that job, then renders the resume as a PDF. There is no backend: the user saves their own API keys in Settings, stored in the browser's IndexedDB. The app is a dashboard (Home, Resume, Settings); the job review and PDF flow is the Resume module. Deployed to GitHub Pages under `/resume-builder/`.

Stack: React 19 (with React Compiler), TypeScript (strict), Vite 7, Tailwind CSS v4, shadcn/ui-style components, `@google/genai`, `@react-pdf/renderer`, React Router v7 (hash router), Dexie (IndexedDB), react-hook-form + zod. Package manager: **pnpm**.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server |
| `pnpm lint` | ESLint |
| `pnpm build` | Type-check (`tsc -b`) and production build |
| `pnpm deploy` | Build and push `dist/` to the `gh-pages` branch (publishes the live site — don't run without being asked) |

There is no test suite yet. Before finishing a change, run `pnpm lint` and `pnpm build`; both must pass.

## Layout

```
src/
  main.tsx              Entry; renders the router
  router.tsx            createHashRouter config; pages are React.lazy
  layouts/DashboardLayout.tsx   Sidebar nav + <Outlet/>
  pages/HomePage.tsx    Dashboard home (placeholder for statistics)
  pages/resume/ResumeGeneratorPage.tsx  The 3-step flow (JD → job review → PDF) and its state
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
  utils/models.ts       Gemini model ids — the only place to set them
  utils/providers.ts    AI providers for keys (only Gemini)
  utils/AIResumeJudge.ts    Job-judging prompt, schema and JudgeResponseType
  utils/AIResumeBuilder.ts  Per-section resume generation (summary/experience/skills)
  utils/AIHealthCheck.ts    API key validation
  lib/utils.ts          `cn()` class-name helper
```

## Routing

Hash URLs (`#/`, `#/resume`, `#/settings`, `#/settings/api-keys`, `#/settings/resume-data`) because GitHub Pages can't serve `index.html` for deep links. Add pages to `router.tsx` as `React.lazy` routes. `#/settings` shows a tile grid; each section is its own page. To add one, add a tile to `SETTINGS_SECTIONS` in `pages/settings/sections.ts` and a child route with the same id under `settings` in `router.tsx`.

## Conventions

- **Personal data comes from the DB, not imports.** `DEFAULT_RESUME_DATA` in `src/data/ResumeData.ts` is only the seed; components read the live copy with `useResumeData()` and pass it down (to `pdf.tsx`, `toUserData()`, `judgeJobPosting`). Don't hardcode names, contacts or experience in components or prompts. When changing `ResumeDataType`, update `resumeDataSchema.ts` and the settings form too (the schema `satisfies z.ZodType<ResumeDataType>`).
- **Forms use react-hook-form + zod** via `zodResolver`, with the fields in `components/form/`. String arrays use `StringListField` (`useFieldArray` only handles arrays of objects).
- **New AI providers** go in `PROVIDERS` in `src/utils/providers.ts`, with a health check in `verifyProviderKey` (`AIHealthCheck.ts`). Keys are verified against the provider before they are saved, not by format. Keys are read with `useProviderKeys(provider)`.
- **Model ids come from `MODELS` in `src/utils/models.ts`.** Don't write model strings inline.
- **AI calls use structured output.** Each call passes a `responseSchema` with `required` fields, and the parsed result is checked before use. When adding a field, update the schema, the TypeScript type (`SectionResults` or `JudgeResponseType`) and the consuming UI together.
- **Every AI call in the UI goes through try/catch/finally** that sets an error state and clears the loading flag. Never leave a spinner that can get stuck.
- **Keep `@react-pdf/renderer` out of the main bundle.** Only `pdf.tsx` and `ResumePreview.tsx` may import it, and `ResumePreview` must stay behind `React.lazy`.
- **Use relative imports.** The `@/` alias isn't wired up (see Gotchas).
- Icons: `lucide-react`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `feat!:` for breaking changes).

## Gotchas

- **Never log or commit API keys.** They are user-supplied at runtime and stored unencrypted in IndexedDB. A legacy `localStorage.geminiKey` is moved into the DB when the database is first created. Don't reintroduce `VITE_*` env vars for them: Vite inlines them into the public bundle.
- **`@/` path alias doesn't work.** In `tsconfig.app.json`, `paths` sits outside `compilerOptions` and Vite has no `resolve.alias`. Files added with the shadcn CLI import from `@/...` and must be rewritten to relative paths (or the alias fixed in both places).
- **`components.json` still says `iconLibrary: "phosphor"`,** but `@phosphor-icons/react` was removed. Components added with the shadcn CLI may import Phosphor; switch them to `lucide-react`.
- **`vite.config.ts` uses `base: '/resume-builder/'`.** Asset paths must work under that prefix.
- **react-pdf is strict about children:** strings must be inside `<Text>`, and stray whitespace between elements inside a `<View>` causes warnings. Lists need `key`s.
- **Prompt changes affect output quality directly.** Keep the numbered instruction blocks in `AIResumeJudge.ts` / `AIResumeBuilder.ts` coherent, and keep the job description and candidate data inside their XML-style tags.
