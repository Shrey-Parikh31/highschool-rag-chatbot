# Middletown High: Academic Assistant

An AI study assistant for high school students, with a separate staff view for
teachers. Students ask about syllabus topics, chapters and deadlines; teachers
additionally see class performance data.

Other projects: [rbac-rag-assistant](https://github.com/Shrey-Parikh31/rbac-rag-assistant) ·
[drivescore-cloud](https://github.com/Shrey-Parikh31/drivescore-cloud)

Built with React + Vite. Answers come from Google Gemini, called from a
serverless function so the API key never reaches the browser.

## Architecture

Retrieval-augmented: answers come from documents uploaded by staff, not from
anything hardcoded.

```
Browser (src/App.jsx)          no key, no course data, no staff data
      |  POST /api/chat    { subjectId, messages, teacherPasscode }
      |  POST /api/upload  file as raw body, passcode in a header   (staff only)
      v
Serverless functions (api/)            the only readers of GEMINI_API_KEY
      |  verify the passcode  -> role
      |  pick which stores that role may search   (api/_stores.js)
      v
Gemini File Search Stores              chunking, embedding and retrieval
      |  <subject>--shared   syllabus, deadlines      students + staff
      |  <subject>--staff    rubrics, grades, notes   staff only
      v
Google Gemini                          answers, grounded, with citations
```

### Why there is no vector database

Gemini's File Search Stores chunk, embed, store and retrieve the documents.
That replaces Pinecone/Chroma, LangChain, a PDF text extractor and S3 - four
moving parts and two subscriptions - with one managed service already covered
by the API key.

There is no schema to migrate either: a store's `displayName` is the registry.
Stores are named `<subjectId>--<scope>`, so finding the right one is a list
call, not a database lookup.

### `.env` beats the Windows environment

Vite's `loadEnv` lets an OS-level variable override `.env`. A `GEMINI_API_KEY`
saved in the Windows user environment for another project once shadowed this
project's key, so the dev server used a revoked key while `.env` held the right
one. `scripts/dotenv.js` now makes the project's `.env` win for both the dev
server and the seed script.

### Stores are local to the environment that created them

**Each environment needs its own seed.** A store created from a laptop is
invisible to the Vercel runtime and vice versa, even with the same API key in
the same Google project. Verified symmetrically: the laptop lists 7 stores and
cannot see one Vercel just created; Vercel lists only its own and returns
`403 PERMISSION_DENIED ... or it may not exist` for the laptop's.

This is not a credential problem. It reproduced identically across two
different API keys, and `Authorization: Bearer` is rejected with "Expected
OAuth 2 access token", which confirms these are real API keys rather than OAuth
tokens. The store namespace appears to be region-local.

So seed a deployment through its own upload endpoint rather than locally:

```bash
npm run seed                                            # local stores
npm run seed -- --remote https://your-app.vercel.app    # the deployment's
```

`--remote` posts to that deployment's `/api/upload`, so the documents are
created by the runtime that will later search them. It reads `TEACHER_PASSCODE`
from `.env`, which must match the deployment's.

Uploading through the teacher panel in a browser has always done the right
thing, because that also goes through the deployment.

### Why the key is not in the frontend

Vite compiles any `VITE_`-prefixed variable directly into the JavaScript bundle.
A key placed there is public the moment the site is deployed, visible in
DevTools and in the built files. Every secret therefore lives server-side, and
the browser only ever talks to `/api/chat`.

### How teacher access actually works

Role is **not** decided by the client. The UI's Student/Teacher pill is a
request; the server verifies `TEACHER_PASSCODE` on every call and serves the
student scope if it doesn't match.

The boundary is enforced at **retrieval**, not in the prompt. A student's
request searches only that subject's `--shared` store, so staff documents are
never read, never chunked into context, and cannot appear in an answer. The
student prompt therefore contains no "do not reveal grades" instruction, there
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
per-user auth means changing how `role` is derived in `api/chat.js`, the
boundary itself does not move.

### Signing in is identity, not permission

`src/auth.jsx` adds a sign-in page: Google, Microsoft, a demo email, or guest.
It deliberately does **not** feed the access boundary. Who you are signed in as
is kept in the browser and never sent to `/api/chat`, so no sign-in can widen
what a request may read. Staff access is still the server-checked passcode
described above, which is why there is no server-side session to forge.

Google and Microsoft are real flows and need a public client id each. Without
one the button says which variable is missing rather than failing on click.

| Provider | Variable | Where to create it |
|---|---|---|
| Google | `VITE_GOOGLE_CLIENT_ID` | <https://console.cloud.google.com/apis/credentials> > Create credentials > OAuth client ID > Web application. Add your site to **Authorised JavaScript origins**. |
| Microsoft | `VITE_MS_CLIENT_ID` | <https://portal.azure.com> > App registrations > New registration > platform **Single-page application**, then tick **ID tokens**. |

Email is a stub on purpose: a real email login needs a mail sender to post the
link, which is a paid service this project does not have. It signs you in under
the name in the address and says so on screen.

### Themes

Light, dark and system, switched in the top bar and remembered in
`localStorage`. Every colour in `App.jsx` resolves through a CSS custom
property, so the two themes are one source of truth; `index.html` applies the
saved choice before first paint so a dark-mode user never sees a white flash.

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
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-lite-latest` (cheapest; see cost section). |
| `GEMINI_FALLBACK_MODEL` | no | Defaults to `gemini-flash-latest`. Used when the primary is busy, out of quota, or refuses the request. |
| `TEACHER_PASSCODE` | no | Unlocks teacher mode. Unset means teacher mode is unreachable. |
| `VITE_GOOGLE_CLIENT_ID` | no | Google sign-in. Public by design; unset hides the button behind a "needs configuring" state. |
| `VITE_MS_CLIENT_ID` | no | Microsoft sign-in. Same. |

### On keeping models current

Both model settings default to `-latest` aliases rather than pinned versions.
Google repoints these as new models ship, and retires old ids: during
development `gemini-2.5-flash` was rejected with *"no longer available to new
users"*. An alias keeps working; a pinned id becomes a maintenance chore.

The free tier also returns intermittent `503 UNAVAILABLE` under load, so
`api/chat.js` retries once and then fails over to the secondary model.

### What it costs

Measured per question: ~1200 input tokens (mostly the retrieved document
chunks) and ~240 output tokens.

| | per question | 100 questions | 1000 questions |
|---|---|---|---|
| `gemini-flash-latest` | ~$0.0018 | ~$0.18 | ~$1.80 |
| `gemini-flash-lite-latest` | ~$0.0008 | ~$0.08 | ~$0.80 |

Indexing an uploaded document costs $0.15 per 1M tokens, so a 10-page syllabus
is well under a cent, one-off.

Cost controls in `api/chat.js`:

- Only the last 12 messages are sent, so a long session costs the same per turn
  as a short one. History was the only unbounded term.
- `maxOutputTokens` 800, and each message truncated to 2000 characters.
- `thinkingConfig.thinkingBudget: 0`, Gemini 3.x Flash otherwise bills ~183
  reasoning tokens as output, roughly 40% on top. Flash-Lite rejects the field
  with a 400, so support is learned per model at runtime instead of assumed.
- Per-IP rate limit of 15 requests per 5 minutes (`RATE_LIMIT_PER_5MIN`),
  because the deployment URL is reachable by anyone who finds it.

Flash-Lite answers first. It was measured answering a grounded question in
3.4s against ~8s for Flash, at about 2.5x lower cost (5x after 2027-01-01, when
Flash's price doubles). Flash remains the fallback.

To cap spend on Google's side, set a monthly spend cap per project at
aistudio.google.com/spend. **Note that a
Cloud budget alerts but does not hard-stop billing**, the only true hard stop
is removing the billing account from the project.

### Free-tier quota (important)

The Gemini free tier allows **20 requests per day, per model, per project**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). That is enough to build
and test, but not enough for a classroom; one student can exhaust it.

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
| `npm run seed` | Loads demo course documents into the local stores |
| `npm run seed -- --remote <url>` | Seeds a deployment through its own `/api/upload` |
| `npm run lint` | ESLint |

## Adding course materials

Sign in as staff (the Teacher pill, then the passcode) and use **Upload course
materials**. Pick the subject, choose who may see the file, and upload a PDF,
DOCX, TXT, MD or HTML file up to 4MB. Answers cite the document they came from.

The same panel lists everything already uploaded for the chosen subject, with
who can see it, and a **Remove** button. Removal deletes the indexed chunks too,
so the document stops being cited immediately.

### Chat history

Student conversations are kept per subject in `sessionStorage`, so they survive
a refresh and switching subjects, and vanish when the tab closes. **Any
conversation containing a staff answer is never stored**, and switching from
Teacher back to Student closes the open chat, school computers are shared, and
grades must not be left behind for the next person.

### Demo syllabus PDFs

`demo-syllabi/` holds a two page syllabus and a staff notes page per subject,
written for Grade 12, Fall 2026 and modeled on real high school syllabi (course
description, units with week ranges, key dates, materials, grading policy with a
letter scale, late work, academic honesty). They are invented demo content.

```bash
py -3 scripts/make_syllabi.py                              rebuild the PDFs
node scripts/publish-syllabi.mjs --remote <url>            upload all 12 subjects
node scripts/publish-syllabi.mjs --remote <url> biology    one subject
node scripts/publish-syllabi.mjs --remote <url> --dir path/to/real/files
```

Publishing uploads `<subject>-syllabus.pdf` for students and
`<subject>-staff-notes.pdf` for staff, then deletes that subject's superseded
`.txt` documents so the assistant cannot cite old and new side by side. It never
deletes a PDF, so re-running cannot discard a real upload. `scripts/seed.js`
remains for the older plain text demo content.

A subject with no uploaded documents says so and refuses to invent a syllabus or
a date, that is deliberate. `npm run seed` loads made-up demo content for all
twelve subjects (a student syllabus and a staff notes file each) so there is
something to demonstrate. It skips any file already uploaded under the same
name, so it is safe to re-run. Delete the demo files from the teacher panel
once real ones are uploaded.

## Deploying

Vercel auto-detects Vite and serves `api/*.js` as functions, no config file
needed. Set `GEMINI_API_KEY` and `TEACHER_PASSCODE` in the project's
Environment Variables. Never commit `.env`.

After the first deploy, seed that deployment's own stores (see "Stores are
local to the environment that created them"):

```bash
npm run seed -- --remote https://your-app.vercel.app
```

Without this the site still works, but every subject reports that no materials
have been uploaded.

## Status

Working: secured backend, retrieval over uploaded documents, role enforced at
retrieval, staff upload and document manager, answer citations, streamed
replies, chat history that survives a refresh, cost controls, model failover,
deployment.

Next: per-user accounts replacing the shared passcode.

### Streaming

Answers stream word by word as newline-delimited JSON (`{"t":"delta"}` lines,
then one `{"t":"done"}` carrying the role, model and sources). Retry and
failover all happen before the first byte: Google returns a status code before
any text, so a busy or exhausted model is swapped out while the reply is still
an ordinary JSON response.

Measured honestly: on a short answer the first words arrived at 7.9s and the
last at 8.1s. Nearly all of the wait is document search before generation
starts, so streaming mainly helps longer answers. The loading label says
"checking your course notes" because that is what is happening.

### Known limitations

- Teacher access is one shared passcode, not per-user accounts. Everyone on
  staff uses the same secret and it cannot be revoked individually.
- Sign-in is identity only. It gates the page, not the data, and the session
  lives in the browser, so it proves nothing to the server by design.
- The email option does not verify anything. It exists so the flow can be
  demonstrated without paying for a mail sender.
- Uploads are capped at 4MB by Vercel's request body limit. Large textbooks
  need splitting.
- Local and deployed stores are separate, so a document uploaded in one is not
  visible in the other. Upload through the environment you want it in.
- A store listing has, once, returned the other environment's stores for a
  single request from a fresh connection. It did not reproduce in 24 further
  local calls or 15 production calls, so it is noted rather than engineered
  around. If a seeded subject ever answers "not uploaded yet", this is why.
