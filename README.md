# Resume Builder

An AI-assisted tool that reviews a job description against your preferences, then tailors your resume to it and renders an ATS-friendly PDF.

Built with React 19, Vite, Tailwind CSS, [`@google/genai`](https://www.npmjs.com/package/@google/genai) (Gemini) and [`@react-pdf/renderer`](https://react-pdf.org/).

## How it works

1. **Job Description** — paste your Gemini API key and the job description. The key is validated, then stored in your browser's `localStorage` (it never leaves your browser except for calls to Gemini).
2. **Job Review** — Gemini scores the job against your preferences and lists pros, cons, red flags, remote likelihood and a verdict.
3. **Resume Rebuild** — Gemini rewrites the summary, experience bullets and skills for the job, and the resume is shown as a PDF you can download.

## Getting started

```bash
pnpm install
pnpm dev
```

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Customising your data

All personal content lives in one file, `src/data/ResumeData.ts`:

| Field | Purpose |
| --- | --- |
| `profile` | Name, contact details, education |
| `experience` | Positions shown in the PDF. `canTweak` marks the one the AI rewrites; its `projects` are the raw work history sent to the AI |
| `hardSkills` | Skills the AI picks from |
| `summary`, `featuredSkills` | Defaults shown before generation |
| `jobPreferences` | Preferences used to judge a job |

The `userData` object the AI prompts receive is derived from this file.

Model ids are set in `src/utils/models.ts`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run the tests |

Pushing to `main` deploys to GitHub Pages: the CI workflow runs lint, tests and build, then publishes `dist/`.
