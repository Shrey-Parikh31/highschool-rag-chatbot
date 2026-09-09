# Middletown High — Academic Assistant

An AI study assistant for high school students, with a separate staff view for
teachers. Students ask about syllabus topics, chapters and deadlines; teachers
additionally see class performance data.

Built with React + Vite. Answers come from Google Gemini, called from a
serverless function so the API key never reaches the browser.

## Architecture

```
Browser (src/App.jsx)          no key, no course data, no staff data
      │  POST /api/chat  { subjectId, messages, teacherPasscode }
      ▼
Serverless function (api/chat.js)      the only place GEMINI_API_KEY is read
      │  builds the system prompt from api/_data.js
      │  decides student vs teacher by verifying the passcode
      ▼
Google Gemini
```

### Why the key is not in the frontend

Vite compiles any `VITE_`-prefixed variable directly into the JavaScript bundle.
A key placed there is public the moment the site is deployed — visible in
DevTools and in the built files. Every secret therefore lives server-side, and
the browser only ever talks to `/api/chat`.

### How teacher access actually works

Role is **not** decided by the client. The UI's Student/Teacher pill is a
request; `api/chat.js` verifies `TEACHER_PASSCODE` on every call and serves the
student prompt if it doesn't match.

This matters more than it sounds. If staff data were placed in the prompt and
the model merely *instructed* not to reveal it, a student could talk it out with
a jailbreak. Instead, for a student request the grades and teacher notes are
never added to the payload at all — so there is nothing to leak. Run
`npm test` to check that property.

The shared passcode is a demo-grade stand-in for real accounts. Swapping it for
per-user auth means changing how `role` is derived in `api/chat.js` — the
boundary itself does not move.

## Local setup

```bash
npm install
cp .env.example .env     # then fill in GEMINI_API_KEY
npm run dev
```

Get a free key at <https://aistudio.google.com/apikey>.

`npm run dev` serves the frontend *and* mounts `api/chat.js` on the same dev
server (see the `devApi` plugin in `vite.config.js`), so local behaviour matches
production without running a second process.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Server-side Gemini key. |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest`. |
| `GEMINI_FALLBACK_MODEL` | no | Defaults to `gemini-flash-lite-latest`. Used when the primary is saturated. |
| `TEACHER_PASSCODE` | no | Unlocks teacher mode. Unset means teacher mode is unreachable. |

### On keeping models current

Both model settings default to `-latest` aliases rather than pinned versions.
Google repoints these as new models ship, and retires old ids: during
development `gemini-2.5-flash` was rejected with *"no longer available to new
users"*. An alias keeps working; a pinned id becomes a maintenance chore.

The free tier also returns intermittent `503 UNAVAILABLE` under load, so
`api/chat.js` retries once and then fails over to the secondary model.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Frontend + API on one dev server |
| `npm run build` | Production build to `dist/` |
| `npm test` | Verifies staff data cannot reach a student prompt |
| `npm run lint` | ESLint |

## Deploying

Vercel auto-detects Vite and serves `api/*.js` as functions — no config file
needed. Set `GEMINI_API_KEY` and `TEACHER_PASSCODE` in the project's
Environment Variables. Never commit `.env`.

## Status

Working: secured backend, server-enforced roles, model failover, deployment.

Next: replace the hardcoded data in `api/_data.js` with real uploaded documents
(Gemini File Search), teacher upload UI, per-user auth, markdown rendering and
chat persistence.

### Known limitations

- Course data is hardcoded demo content. Only Mathematics, Physics and English
  have real entries; the other nine subjects generate placeholder syllabi that
  look real but are invented. This is the main reason for the RAG work above.
- Replies render as plain text, so markdown `**bold**` shows literal asterisks.
- Chat history is lost on refresh and when switching subjects.
