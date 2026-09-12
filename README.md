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
request; the server verifies `TEACHER_PASSCODE` on every call and serves the
student scope if it doesn't match.

The boundary is enforced at **retrieval**, not in the prompt. A student's
request searches only that subject's `--shared` store, so staff documents are
never read, never chunked into context, and cannot appear in an answer. The
student prompt therefore contains no "do not reveal grades" instruction — there
is nothing present to withhold.

That distinction is visible in the API response. Asked for the class average:

```
student  sources: ["math-syllabus.txt"]                          -> "the documents don't include that"
teacher  sources: ["math-staff-notes.txt", "math-syllabus.txt"]  -> "class average 74%, lowest 41%"
```

The student answer is not a refusal the model chose. It is the only answer
available from the documents it was allowed to search. Run `npm test` to check
that scopes never collide.

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

### Free-tier quota (important)

The Gemini free tier allows **20 requests per day, per model, per project**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). That is enough to build
and test, but not enough for a classroom — one student can exhaust it.

Because the cap is *per model*, the primary/fallback pair gives roughly double
the daily budget, and `api/chat.js` fails over immediately on a 429 rather than
retrying a model whose quota is already gone.

For real use, enable billing on the Google Cloud project behind the API key.
Flash-class models are inexpensive; the daily request cap is the binding
constraint, not the token cost.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Frontend + API on one dev server |
| `npm run build` | Production build to `dist/` |
| `npm test` | Verifies staff stores are never in a student's scope |
| `npm run seed` | Loads demo course documents into the stores |
| `npm run lint` | ESLint |

## Adding course materials

Sign in as staff (the Teacher pill, then the passcode) and use **Upload course
materials**. Pick the subject, choose who may see the file, and upload a PDF,
DOCX, TXT, MD or HTML file up to 4MB. Answers cite the document they came from.

A subject with no uploaded documents says so and refuses to invent a syllabus or
a date — that is deliberate. `npm run seed` loads demo content for maths,
physics and English so there is something to demonstrate.

## Deploying

Vercel auto-detects Vite and serves `api/*.js` as functions — no config file
needed. Set `GEMINI_API_KEY` and `TEACHER_PASSCODE` in the project's
Environment Variables. Never commit `.env`.

## Status

Working: secured backend, retrieval over uploaded documents, role enforced at
retrieval, staff upload UI, answer citations, model failover, deployment.

Next: per-user accounts replacing the shared passcode, a document manager for
staff (list and delete what has been uploaded), streamed replies, and chat
history that survives a refresh.

### Known limitations

- Teacher access is one shared passcode, not per-user accounts. Everyone on
  staff uses the same secret and it cannot be revoked individually.
- Uploads are capped at 4MB by Vercel's request body limit. Large textbooks
  need splitting.
- There is no way to list or delete uploaded documents from the UI yet.
- Chat history is lost on refresh and when switching subjects.
