// Seed the File Search Stores with the demo course content.
//
//   node scripts/seed.js                      seed the local stores
//   node scripts/seed.js math                 seed one subject
//   node scripts/seed.js --remote <base-url>  seed a deployment through its
//                                             own /api/upload (see uploadRemote)
//
// This content used to be hardcoded into the prompt in api/_data.js. It is kept
// here, outside the request path, purely so the demo has something to retrieve.
// Replace it by uploading real syllabus PDFs through the app's teacher panel —
// nothing in the running app reads this file.

import { readFileSync } from "node:fs";
import { ensureStore, uploadDocument, SCOPES } from "../api/_stores.js";

// Minimal .env reader: this is a one-off script, not worth a dotenv dependency.
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const COURSE_DATA = {
  math: {
    name: "Mathematics",
    syllabus: ["Ch1: Algebra Foundations", "Ch2: Quadratic Functions", "Ch3: Trigonometry", "Ch4: Calculus Intro", "Ch5: Statistics & Probability"],
    timeline: [{ date: "Feb 10", event: "Ch2 Quiz" }, { date: "Mar 5", event: "Mid-Term Exam (Ch1-Ch3)" }, { date: "Apr 12", event: "Ch4 Assignment Due" }, { date: "May 20", event: "Final Exam" }],
    extracts: {
      Ch1: "Chapter 1 covers linear equations, inequalities, and systems of equations. Key topics: solving for variables, graphing lines (y=mx+b), substitution/elimination methods.",
      Ch2: "Chapter 2: Quadratic Functions. Standard form ax^2+bx+c=0. Vertex form y=a(x-h)^2+k. Discriminant b^2-4ac determines roots. Factoring, completing the square, quadratic formula.",
      Ch3: "Chapter 3: Trigonometry. SOH-CAH-TOA. Unit circle, radians vs degrees. Sin/Cos/Tan and inverses. Pythagorean identity: sin^2(theta) + cos^2(theta) = 1.",
    },
    teacherNotes: "Predicted weak area: Ch2 (quadratics). Recommend extra drill problems. Grading split: 30% HW, 40% Tests, 30% Final.",
    grades: { classAverage: 74, highest: 98, lowest: 41 },
  },
  physics: {
    name: "Physics",
    syllabus: ["Ch1: Kinematics", "Ch2: Newton's Laws", "Ch3: Work, Energy & Power", "Ch4: Waves & Light", "Ch5: Electricity & Magnetism"],
    timeline: [{ date: "Feb 20", event: "Lab Report: Motion" }, { date: "Mar 10", event: "Mid-Term (Ch1-Ch3)" }, { date: "Apr 25", event: "Electricity Project Due" }, { date: "May 19", event: "Final Exam" }],
    extracts: {
      Ch1: "Kinematics - motion without forces. Key equations: v=u+at, s=ut+0.5at^2, v^2=u^2+2as. Projectile motion = horizontal uniform + vertical free fall.",
      Ch2: "Newton's Laws: (1) Inertia. (2) F=ma. (3) Equal and opposite reaction. Free body diagrams are essential.",
    },
    teacherNotes: "Lab work = 25% of grade. Goggles mandatory for all electricity labs.",
    grades: { classAverage: 71, highest: 95, lowest: 38 },
  },
  english: {
    name: "English Literature",
    syllabus: ["Unit 1: Short Stories", "Unit 2: Poetry Analysis", "Unit 3: Shakespeare - Macbeth", "Unit 4: Modern Fiction", "Unit 5: Essay Writing"],
    timeline: [{ date: "Feb 14", event: "Poetry Essay Due" }, { date: "Mar 18", event: "Macbeth Scene Analysis" }, { date: "Apr 8", event: "Book Report Due" }, { date: "May 22", event: "Final Exam" }],
    extracts: {
      "Unit 2": "Poetry unit covers: imagery, metaphor, simile, personification, alliteration. Featured poets: Langston Hughes, Emily Dickinson, Sylvia Plath.",
      "Unit 3": "Macbeth Act 1, Scene 7 - soliloquy expresses moral ambivalence about murdering King Duncan. Themes: ambition, guilt, fate vs free will.",
    },
    teacherNotes: "Thesis construction is a recurring weak spot. Participation = 15% of final mark.",
    grades: { classAverage: 79, highest: 96, lowest: 55 },
  },
};

const sharedDoc = (d) => `
MIDDLETOWN HIGH SCHOOL - ${d.name.toUpperCase()}
Year 12, Spring Semester 2026
Course syllabus and key dates. Student handout.

SYLLABUS
${d.syllabus.map((s) => `- ${s}`).join("\n")}

KEY DATES AND DEADLINES
${d.timeline.map((t) => `- ${t.date}: ${t.event}`).join("\n")}

CHAPTER AND UNIT CONTENT
${Object.entries(d.extracts).map(([k, v]) => `${k}\n${v}`).join("\n\n")}
`.trim();

const staffDoc = (d) => `
MIDDLETOWN HIGH SCHOOL - ${d.name.toUpperCase()}
STAFF ONLY. Not for distribution to students.

TEACHER NOTES
${d.teacherNotes}

CLASS PERFORMANCE (Year 12, Spring 2026)
- Class average: ${d.grades.classAverage}%
- Highest score: ${d.grades.highest}%
- Lowest score: ${d.grades.lowest}%
`.trim();

async function uploadLocal(apiKey, subjectId, scope, filename, text) {
  const store = await ensureStore(apiKey, subjectId, scope);
  await uploadDocument(apiKey, store, filename, text, "text/plain");
}

/**
 * Seed through a deployed instance's own upload endpoint.
 *
 * Gemini scopes a File Search Store to the context that created it: stores
 * created from a laptop are invisible to (and 403 from) the Vercel runtime,
 * even with a byte-identical API key. So each environment has to create its
 * own stores, which means going through that environment's /api/upload.
 */
async function uploadRemote(baseUrl, passcode, subjectId, scope, filename, text) {
  const qs = new URLSearchParams({ subjectId, scope, filename });
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/upload?${qs}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "x-teacher-passcode": passcode },
    body: text,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set (looked in .env).");
  process.exit(1);
}

const args = process.argv.slice(2);
const remoteIdx = args.indexOf("--remote");
const remote = remoteIdx !== -1 ? args[remoteIdx + 1] : null;
if (remoteIdx !== -1) args.splice(remoteIdx, 2);
const only = args[0];
const targets = only ? [only] : Object.keys(COURSE_DATA);

if (remote && !process.env.TEACHER_PASSCODE) {
  console.error("--remote needs TEACHER_PASSCODE (looked in .env), and it must match the deployment's.");
  process.exit(1);
}

const put = (id, scope, filename, text) =>
  remote
    ? uploadRemote(remote, process.env.TEACHER_PASSCODE, id, scope, filename, text)
    : uploadLocal(apiKey, id, scope, filename, text);

console.log(remote ? `seeding ${remote}` : "seeding locally");

for (const id of targets) {
  const d = COURSE_DATA[id];
  if (!d) {
    console.error(`  ! unknown subject "${id}"`);
    process.exitCode = 1;
    continue;
  }
  await put(id, SCOPES.SHARED, `${id}-syllabus.txt`, sharedDoc(d));
  console.log(`  ${id}: ${id}-syllabus.txt -> ${id}--shared`);
  await put(id, SCOPES.STAFF, `${id}-staff-notes.txt`, staffDoc(d));
  console.log(`  ${id}: ${id}-staff-notes.txt -> ${id}--staff`);
}
console.log("done.");
