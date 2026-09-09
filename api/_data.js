// Server-only course data. Never bundled into the browser.
// ponytail: hardcoded demo data — deleted in the RAG step, when real uploaded
// documents replace it. Don't invest in structure that's about to be thrown away.

export const SUBJECT_NAMES = {
  math: "Mathematics",
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  english: "English Literature",
  history: "History",
  geography: "Geography",
  cs: "Computer Science",
  economics: "Economics",
  french: "French",
  art: "Visual Arts",
  pe: "Physical Education",
};

export const COURSE_DATA = {
  math: {
    syllabus: ["Ch1: Algebra Foundations", "Ch2: Quadratic Functions", "Ch3: Trigonometry", "Ch4: Calculus Intro", "Ch5: Statistics & Probability"],
    timeline: [{ date: "Feb 10", event: "Ch2 Quiz" }, { date: "Mar 5", event: "Mid-Term Exam (Ch1–Ch3)" }, { date: "Apr 12", event: "Ch4 Assignment Due" }, { date: "May 20", event: "Final Exam" }],
    extracts: {
      Ch1: "Chapter 1 covers linear equations, inequalities, and systems of equations. Key topics: solving for variables, graphing lines (y=mx+b), substitution/elimination methods.",
      Ch2: "Chapter 2: Quadratic Functions. Standard form ax²+bx+c=0. Vertex form y=a(x-h)²+k. Discriminant b²-4ac determines roots. Factoring, completing the square, quadratic formula.",
      Ch3: "Chapter 3: Trigonometry. SOH-CAH-TOA. Unit circle, radians vs degrees. Sin/Cos/Tan and inverses. Pythagorean identity: sin²θ + cos²θ = 1.",
    },
    teacherNotes: "Predicted weak area: Ch2 (quadratics). Recommend extra drill problems. Grading split: 30% HW, 40% Tests, 30% Final.",
    grades: { classAverage: 74, highest: 98, lowest: 41 },
  },
  english: {
    syllabus: ["Unit 1: Short Stories", "Unit 2: Poetry Analysis", "Unit 3: Shakespeare – Macbeth", "Unit 4: Modern Fiction", "Unit 5: Essay Writing"],
    timeline: [{ date: "Feb 14", event: "Poetry Essay Due" }, { date: "Mar 18", event: "Macbeth Scene Analysis" }, { date: "Apr 8", event: "Book Report Due" }, { date: "May 22", event: "Final Exam" }],
    extracts: {
      "Unit 2": "Poetry unit covers: imagery, metaphor, simile, personification, alliteration. Featured poets: Langston Hughes, Emily Dickinson, Sylvia Plath.",
      "Unit 3": "Macbeth Act 1, Scene 7 — soliloquy expresses moral ambivalence about murdering King Duncan. Themes: ambition, guilt, fate vs free will.",
    },
    teacherNotes: "Thesis construction is a recurring weak spot. Participation = 15% of final mark.",
    grades: { classAverage: 79, highest: 96, lowest: 55 },
  },
  physics: {
    syllabus: ["Ch1: Kinematics", "Ch2: Newton's Laws", "Ch3: Work, Energy & Power", "Ch4: Waves & Light", "Ch5: Electricity & Magnetism"],
    timeline: [{ date: "Feb 20", event: "Lab Report: Motion" }, { date: "Mar 10", event: "Mid-Term (Ch1–Ch3)" }, { date: "Apr 25", event: "Electricity Project Due" }, { date: "May 19", event: "Final Exam" }],
    extracts: {
      Ch1: "Kinematics — motion without forces. Key equations: v=u+at, s=ut+½at², v²=u²+2as. Projectile motion = horizontal uniform + vertical free fall.",
      Ch2: "Newton's Laws: (1) Inertia. (2) F=ma. (3) Equal and opposite reaction. Free body diagrams are essential.",
    },
    teacherNotes: "Lab work = 25% of grade. Goggles mandatory for all electricity labs.",
    grades: { classAverage: 71, highest: 95, lowest: 38 },
  },
};

const getFallbackData = (name) => ({
  syllabus: [`Unit 1: ${name} Foundations`, "Unit 2: Core Concepts", "Unit 3: Advanced Topics", "Unit 4: Applications", "Unit 5: Review"],
  timeline: [{ date: "Mar 1", event: "Unit 2 Quiz" }, { date: "Mar 28", event: "Mid-Term" }, { date: "Apr 30", event: "Project Due" }, { date: "May 21", event: "Final Exam" }],
  extracts: { "Unit 1": `${name} Unit 1 covers foundational principles, vocabulary, and frameworks essential to the subject.` },
  teacherNotes: "Check with department head for the full marking rubric.",
  grades: { classAverage: 76, highest: 94, lowest: 48 },
});

export function buildSystemPrompt(role, subjectId) {
  // Object.hasOwn, not a truthiness check: SUBJECT_NAMES["__proto__"] would
  // otherwise return Object.prototype and sail past the guard.
  if (typeof subjectId !== "string" || !Object.hasOwn(SUBJECT_NAMES, subjectId)) return null;
  const name = SUBJECT_NAMES[subjectId];
  const data = Object.hasOwn(COURSE_DATA, subjectId) ? COURSE_DATA[subjectId] : getFallbackData(name);

  const base = `
You are a helpful academic assistant for Middletown High School.
Subject: ${name}
Syllabus: ${data.syllabus.join(", ")}
Upcoming dates: ${data.timeline.map((t) => `${t.date} – ${t.event}`).join(", ")}
Chapter content: ${Object.entries(data.extracts).map(([k, v]) => `[${k}]: ${v}`).join(" | ")}
- Point users to the exact chapter or unit when asked about a topic
- Keep answers short and friendly
- Mention relevant deadlines when it makes sense
- If the answer isn't in the data, say so honestly
`.trim();

  // Staff-only fields are appended ONLY for teachers, so a student request never
  // carries them over the wire. This is the boundary — not the instruction below it.
  if (role === "teacher") {
    return `${base}\n\nTEACHER ACCESS — Class avg: ${data.grades.classAverage}%, Highest: ${data.grades.highest}%, Lowest: ${data.grades.lowest}%. Notes: ${data.teacherNotes}. You may discuss class performance and grading.`;
  }
  return base;
}
