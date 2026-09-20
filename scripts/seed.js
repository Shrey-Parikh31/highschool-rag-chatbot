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

import { fileURLToPath } from "node:url";
import { ensureStore, findStore, listDocuments, uploadDocument, SCOPES } from "../api/_stores.js";
import { readDotEnv } from "./dotenv.js";

// .env overrides the OS environment — see scripts/dotenv.js for why.
Object.assign(process.env, readDotEnv(fileURLToPath(new URL("../.env", import.meta.url))));

const COURSE_DATA = {
  math: {
    name: "Mathematics",
    syllabus: ["Ch1: Algebra Foundations", "Ch2: Quadratic Functions", "Ch3: Trigonometry", "Ch4: Calculus Intro", "Ch5: Statistics & Probability"],
    timeline: [{ date: "Sep 25", event: "Ch2 Quiz" }, { date: "Oct 20", event: "Mid-Term Exam (Ch1-Ch3)" }, { date: "Nov 13", event: "Ch4 Assignment Due" }, { date: "Dec 15", event: "Final Exam" }],
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
    timeline: [{ date: "Oct 2", event: "Lab Report: Motion" }, { date: "Oct 22", event: "Mid-Term (Ch1-Ch3)" }, { date: "Nov 20", event: "Electricity Project Due" }, { date: "Dec 16", event: "Final Exam" }],
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
    timeline: [{ date: "Sep 29", event: "Poetry Essay Due" }, { date: "Oct 26", event: "Macbeth Scene Analysis" }, { date: "Nov 17", event: "Book Report Due" }, { date: "Dec 16", event: "Final Exam" }],
    extracts: {
      "Unit 2": "Poetry unit covers: imagery, metaphor, simile, personification, alliteration. Featured poets: Langston Hughes, Emily Dickinson, Sylvia Plath.",
      "Unit 3": "Macbeth Act 1, Scene 7 - soliloquy expresses moral ambivalence about murdering King Duncan. Themes: ambition, guilt, fate vs free will.",
    },
    teacherNotes: "Thesis construction is a recurring weak spot. Participation = 15% of final mark.",
    grades: { classAverage: 79, highest: 96, lowest: 55 },
  },
  chemistry: {
    name: "Chemistry",
    syllabus: ["Unit 1: Atomic Structure and Periodicity", "Unit 2: Chemical Bonding (ionic, covalent, metallic)", "Unit 3: Stoichiometry and the Mole", "Unit 4: Acids, Bases and pH", "Unit 5: Organic Chemistry Foundations"],
    timeline: [{ date: "Sep 30", event: "Unit 2 Bonding Quiz" }, { date: "Oct 21", event: "Mid-Term Exam (Units 1-3)" }, { date: "Nov 18", event: "Titration Lab Report due" }, { date: "Dec 14", event: "Final Exam (all units)" }],
    extracts: {
      "Unit 1": "Protons, neutrons and electrons; electron configuration; periodic trends in atomic radius, ionization energy and electronegativity across a period and down a group.",
      "Unit 3": "The mole is 6.022 x 10^23 particles. Moles = mass / molar mass. Balance equations before using mole ratios. The limiting reagent determines the maximum product.",
      "Lab safety": "Goggles and lab coats are mandatory for every lab session. Students without goggles are sent out and marked absent for that lab.",
    },
    teacherNotes: "Mole calculations are the biggest stumbling block; run two extra worked-example sessions before the mid-term. Grading: 25% labs, 35% tests, 40% final.",
    grades: { classAverage: 72, highest: 97, lowest: 44 },
  },
  biology: {
    name: "Biology",
    syllabus: ["Unit 1: Cell Structure and Function", "Unit 2: Genetics and Inheritance", "Unit 3: Evolution and Natural Selection", "Unit 4: Human Body Systems", "Unit 5: Ecology"],
    timeline: [{ date: "Sep 24", event: "Microscope Lab" }, { date: "Oct 19", event: "Mid-Term Exam (Units 1-2)" }, { date: "Nov 12", event: "Ecology Field Report due" }, { date: "Dec 15", event: "Final Exam" }],
    extracts: {
      "Unit 1": "Prokaryotic vs eukaryotic cells. Organelles: nucleus, mitochondria (respiration), ribosomes (protein synthesis), chloroplasts (photosynthesis, plants only). Diffusion, osmosis and active transport.",
      "Unit 2": "DNA is a double helix with base pairs A-T and C-G. Mitosis makes identical body cells; meiosis makes gametes. Punnett squares predict offspring ratios for dominant and recessive alleles.",
    },
    teacherNotes: "Students confuse mitosis and meiosis every year; use the comparison table. Field report = 20% of grade.",
    grades: { classAverage: 77, highest: 99, lowest: 49 },
  },
  history: {
    name: "History",
    syllabus: ["Unit 1: The Industrial Revolution", "Unit 2: World War I", "Unit 3: The Interwar Years and the Great Depression", "Unit 4: World War II", "Unit 5: The Cold War"],
    timeline: [{ date: "Sep 28", event: "Source Analysis Essay due" }, { date: "Oct 23", event: "Mid-Term Exam (Units 1-3)" }, { date: "Nov 19", event: "Research Project due" }, { date: "Dec 18", event: "Final Exam" }],
    extracts: {
      "Unit 2": "Long-term causes of WWI: militarism, alliances, imperialism, nationalism (MAIN). Short-term trigger: the assassination of Archduke Franz Ferdinand, June 1914.",
      "Unit 3": "The 1929 Wall Street Crash led to the Great Depression, mass unemployment and the rise of extremist parties in Europe. The Treaty of Versailles fueled resentment in Germany.",
    },
    teacherNotes: "Essays tend to describe rather than analyze; push why-questions. Research project = 25% of grade.",
    grades: { classAverage: 75, highest: 94, lowest: 51 },
  },
  geography: {
    name: "Geography",
    syllabus: ["Unit 1: Plate Tectonics and Hazards", "Unit 2: Weather and Climate", "Unit 3: Rivers and Coasts", "Unit 4: Urbanization", "Unit 5: Resource Management"],
    timeline: [{ date: "Oct 1", event: "Map Skills Test" }, { date: "Oct 26", event: "Mid-Term Exam (Units 1-2)" }, { date: "Nov 10", event: "River Fieldwork Write-up due" }, { date: "Dec 17", event: "Final Exam" }],
    extracts: {
      "Unit 1": "Constructive (divergent), destructive (convergent) and conservative (transform) plate boundaries. Earthquakes occur at all three; volcanoes mainly at constructive and destructive boundaries.",
      "Unit 3": "River processes: erosion (hydraulic action, abrasion, attrition, solution), transport and deposition. Landforms include waterfalls, meanders, ox-bow lakes and floodplains.",
    },
    teacherNotes: "Case-study detail is weak; students need named places and figures. Fieldwork = 20% of grade.",
    grades: { classAverage: 78, highest: 95, lowest: 52 },
  },
  cs: {
    name: "Computer Science",
    syllabus: ["Unit 1: Programming Fundamentals (Python)", "Unit 2: Data Structures", "Unit 3: Algorithms: Searching and Sorting", "Unit 4: Computer Networks", "Unit 5: Databases and SQL"],
    timeline: [{ date: "Sep 23", event: "Python Mini-Project due" }, { date: "Oct 19", event: "Mid-Term Exam (Units 1-3)" }, { date: "Dec 4", event: "Final Project due" }, { date: "Dec 15", event: "Final Exam" }],
    extracts: {
      "Unit 2": "Lists, stacks (last in, first out), queues (first in, first out) and dictionaries (key-value pairs). Choose the structure by how data is added and removed.",
      "Unit 3": "Linear search checks each item, O(n). Binary search halves a sorted list each step, O(log n). Bubble sort is O(n^2); merge sort is O(n log n).",
    },
    teacherNotes: "Big-O notation needs more practice. Final project = 30% of grade; the academic honesty policy applies to all code.",
    grades: { classAverage: 81, highest: 100, lowest: 47 },
  },
  economics: {
    name: "Economics",
    syllabus: ["Unit 1: Supply and Demand", "Unit 2: Market Structures", "Unit 3: Macroeconomic Indicators (GDP, inflation, unemployment)", "Unit 4: Fiscal and Monetary Policy", "Unit 5: International Trade"],
    timeline: [{ date: "Oct 5", event: "Market Analysis Assignment due" }, { date: "Oct 22", event: "Mid-Term Exam (Units 1-3)" }, { date: "Nov 18", event: "Policy Debate" }, { date: "Dec 16", event: "Final Exam" }],
    extracts: {
      "Unit 1": "Law of demand: as price rises, quantity demanded falls. Equilibrium is where supply meets demand. A shift of the whole curve is caused by non-price factors such as income or tastes.",
      "Unit 4": "Fiscal policy is government spending and taxation. Monetary policy is the central bank setting interest rates and the money supply. Higher interest rates usually reduce inflation.",
    },
    teacherNotes: "Diagram labeling costs easy marks; insist on labelled axes. Debate participation = 10% of grade.",
    grades: { classAverage: 76, highest: 96, lowest: 50 },
  },
  french: {
    name: "French",
    syllabus: ["Unit 1: Present Tense and Everyday Conversation", "Unit 2: Passe Compose and Imparfait", "Unit 3: Travel and Directions", "Unit 4: Future and Conditional Tenses", "Unit 5: French-Speaking Cultures"],
    timeline: [{ date: "Sep 26", event: "Vocabulary Quiz" }, { date: "Oct 27", event: "Mid-Term Exam (written and oral, Units 1-2)" }, { date: "Nov 17", event: "Oral Presentation" }, { date: "Dec 18", event: "Final Exam" }],
    extracts: {
      "Unit 2": "Passe compose = avoir or etre + past participle, for completed actions (j'ai mange). Imparfait = ongoing or repeated past actions and descriptions (je mangeais). Verbs of movement take etre.",
      "Unit 3": "Useful phrases: Ou est la gare ? (Where is the station?), tournez a gauche / a droite (turn left / right), allez tout droit (go straight on).",
    },
    teacherNotes: "Oral confidence is low; pair practice each lesson. Oral components = 30% of grade.",
    grades: { classAverage: 74, highest: 98, lowest: 46 },
  },
  art: {
    name: "Visual Arts",
    syllabus: ["Unit 1: Drawing and Observation", "Unit 2: Color Theory", "Unit 3: Art History: Renaissance to Modernism", "Unit 4: Mixed Media", "Unit 5: Personal Portfolio"],
    timeline: [{ date: "Oct 2", event: "Observational Drawing Portfolio check" }, { date: "Oct 28", event: "Mid-Term Critique" }, { date: "Nov 20", event: "Mixed Media Piece due" }, { date: "Dec 11", event: "Final Portfolio Exhibition" }],
    extracts: {
      "Unit 2": "Primary colors: red, yellow, blue. Complementary colors sit opposite each other on the color wheel and create contrast. Warm colors advance; cool colors recede.",
      "Unit 3": "The Renaissance introduced linear perspective. Impressionism (Monet) captured light and the moment. Cubism (Picasso) showed several viewpoints at once.",
    },
    teacherNotes: "Sketchbook annotation is thin; require a written reflection on each piece. Portfolio = 60% of grade.",
    grades: { classAverage: 84, highest: 98, lowest: 61 },
  },
  pe: {
    name: "Physical Education",
    syllabus: ["Unit 1: Fitness Components and Testing", "Unit 2: Anatomy and Physiology", "Unit 3: Team Sports: Basketball and Soccer", "Unit 4: Health and Nutrition", "Unit 5: Personal Fitness Plan"],
    timeline: [{ date: "Sep 22", event: "Baseline Fitness Test" }, { date: "Oct 19", event: "Mid-Term Theory Test (Units 1-2)" }, { date: "Nov 13", event: "Personal Fitness Plan due" }, { date: "Dec 10", event: "Final Practical Assessment" }],
    extracts: {
      "Unit 1": "Components of fitness: cardiovascular endurance, muscular strength, muscular endurance, flexibility and body composition. The beep test measures cardiovascular endurance.",
      "Kit": "Full PE kit and sneakers are required for every practical lesson. No jewelry. Bring a water bottle.",
    },
    teacherNotes: "Theory marks lag practical marks; add short weekly quizzes. Practical = 50%, theory = 50%.",
    grades: { classAverage: 80, highest: 97, lowest: 58 },
  },
};

const sharedDoc = (d) => `
MIDDLETOWN HIGH SCHOOL - ${d.name.toUpperCase()}
Grade 12, Fall Semester 2026
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

CLASS PERFORMANCE (Grade 12, Fall 2026)
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

// Idempotent: a file already present under the same name is skipped, so
// re-running the seed never makes the bot cite the same syllabus twice.
async function existing(id) {
  if (remote) {
    const res = await fetch(`${remote.replace(/\/$/, "")}/api/documents?subjectId=${id}`, {
      headers: { "x-teacher-passcode": process.env.TEACHER_PASSCODE },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return new Set(data.documents.map((d) => d.displayName));
  }
  const names = new Set();
  for (const scope of [SCOPES.SHARED, SCOPES.STAFF]) {
    const store = await findStore(apiKey, id, scope);
    if (store) for (const d of await listDocuments(apiKey, store)) names.add(d.displayName);
  }
  return names;
}

const put = async (have, id, scope, filename, text) => {
  if (have.has(filename)) return `${filename} already there, skipped`;
  await (remote
    ? uploadRemote(remote, process.env.TEACHER_PASSCODE, id, scope, filename, text)
    : uploadLocal(apiKey, id, scope, filename, text));
  return `${filename} -> ${id}--${scope}`;
};

console.log(remote ? `seeding ${remote}` : "seeding locally");

for (const id of targets) {
  const d = COURSE_DATA[id];
  if (!d) {
    console.error(`  ! unknown subject "${id}"`);
    process.exitCode = 1;
    continue;
  }
  const have = await existing(id);
  console.log(`  ${id}: ${await put(have, id, SCOPES.SHARED, `${id}-syllabus.txt`, sharedDoc(d))}`);
  console.log(`  ${id}: ${await put(have, id, SCOPES.STAFF, `${id}-staff-notes.txt`, staffDoc(d))}`);
}
console.log("done.");
