# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

A client-only React app that uses Google Gemini to (1) judge a job description against the owner's preferences and (2) rewrite resume sections for that job, then renders the resume as a PDF. There is no backend: the user pastes their own Gemini API key, which is stored in `localStorage`. Deployed to GitHub Pages under `/resume-builder/`.

Stack: React 19 (with React Compiler), TypeScript (strict), Vite 7, Tailwind CSS v4, shadcn/ui-style components, `@google/genai`, `@react-pdf/renderer`. Package manager: **pnpm**.

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
  main.tsx              Entry; renders NewApp
  NewApp.tsx            The whole 3-step flow (key + JD → job review → PDF) and its state
  JudgeResponse.tsx     Job review view
  Gauge.tsx             Match-score gauge
  ResumePreview.tsx     PDFViewer wrapper, lazy-loaded by NewApp
  pdf.tsx               The resume PDF layout (@react-pdf/renderer)
  data/ResumeData.ts    ALL personal content + derived `userData` for prompts
  types/input.ts        Data types (ResumeDataType, Position, UserData, ...)
  utils/models.ts       Gemini model ids — the only place to set them
  utils/AIResumeJudge.ts    Job-judging prompt, schema and JudgeResponseType
  utils/AIResumeBuilder.ts  Per-section resume generation (summary/experience/skills)
  utils/AIHealthCheck.ts    API key validation
  components/ui/        Button, Stepper (shadcn-style)
  lib/utils.ts          `cn()` class-name helper
```

## Conventions

- **Personal data lives only in `src/data/ResumeData.ts`.** Don't hardcode names, contacts or experience in components or prompts. `userData` (what the AI sees) is derived from it — change the source, not the derived object.
- **Model ids come from `MODELS` in `src/utils/models.ts`.** Don't write model strings inline.
- **AI calls use structured output.** Each call passes a `responseSchema` with `required` fields, and the parsed result is checked before use. When adding a field, update the schema, the TypeScript type (`SectionResults` or `JudgeResponseType`) and the consuming UI together.
- **Every AI call in the UI goes through try/catch/finally** that sets `stepError` and clears the loading flag. Never leave a spinner that can get stuck.
- **Keep `@react-pdf/renderer` out of the main bundle.** Only `pdf.tsx` and `ResumePreview.tsx` may import it, and `ResumePreview` must stay behind `React.lazy`.
- **Use relative imports.** The `@/` alias isn't wired up (see Gotchas).
- Icons: `lucide-react`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `feat!:` for breaking changes).

## Gotchas

- **Never log or commit the Gemini key.** It is user-supplied at runtime. Don't reintroduce `VITE_*` env vars for it: Vite inlines them into the public bundle.
- **`@/` path alias doesn't work.** In `tsconfig.app.json`, `paths` sits outside `compilerOptions` and Vite has no `resolve.alias`. Files added with the shadcn CLI import from `@/...` and must be rewritten to relative paths (or the alias fixed in both places).
- **`components.json` still says `iconLibrary: "phosphor"`,** but `@phosphor-icons/react` was removed. Components added with the shadcn CLI may import Phosphor; switch them to `lucide-react`.
- **`vite.config.ts` uses `base: '/resume-builder/'`.** Asset paths must work under that prefix.
- **react-pdf is strict about children:** strings must be inside `<Text>`, and stray whitespace between elements inside a `<View>` causes warnings. Lists need `key`s.
- **Prompt changes affect output quality directly.** Keep the numbered instruction blocks in `AIResumeJudge.ts` / `AIResumeBuilder.ts` coherent, and keep the job description and candidate data inside their XML-style tags.
