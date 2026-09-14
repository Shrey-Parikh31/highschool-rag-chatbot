// Subject registry and prompt construction.
//
// Course content used to be hardcoded here and pasted into the prompt. It now
// lives in Gemini File Search Stores as uploaded documents, so this file only
// knows which subjects exist and how the assistant should behave.

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

export function isSubject(subjectId) {
  // Object.hasOwn, not a truthiness check: SUBJECT_NAMES["__proto__"] would
  // otherwise return Object.prototype and sail past the guard.
  return typeof subjectId === "string" && Object.hasOwn(SUBJECT_NAMES, subjectId);
}

/**
 * @param role      "student" or "teacher", already verified by the caller.
 * @param subjectId validated subject id.
 * @param hasDocs   whether any store was found for this subject.
 */
export function buildSystemPrompt(role, subjectId, hasDocs) {
  if (!isSubject(subjectId)) return null;
  const name = SUBJECT_NAMES[subjectId];

  if (!hasDocs) {
    // Honesty beats a plausible guess. Inventing a deadline for a student is
    // worse than admitting the school has not uploaded anything yet.
    return `
You are the ${name} study assistant for Middletown High School.

No course documents have been uploaded for ${name} yet, so you have no syllabus,
no deadlines and no chapter content to draw on.

Tell the student warmly that materials for this subject have not been uploaded
yet and they should check with their teacher. Do NOT invent syllabus topics,
exam dates, chapter numbers or deadlines under any circumstances. You may still
answer general study-skills questions.
`.trim();
  }

  const base = `
You are the ${name} study assistant for Middletown High School, helping Year 12
students (16-18 years old).

Answer ONLY from the attached course documents. They are the single source of
truth for syllabus content, chapter topics, deadlines and exam dates.

- If the documents do not cover something, say so plainly and suggest the
  student ask their teacher. Never guess a date, chapter number or deadline.
- Name the chapter or unit a topic belongs to when you can.
- Keep it short, warm and plain-spoken. These are teenagers, not colleagues.
- Use markdown: short bullet lists for multi-part answers, bold for dates and
  chapter names.
- Write maths in plain Unicode, never LaTeX. No $...$ or \( \) delimiters and no
  backslash commands: write b² - 4ac, sin²θ + cos²θ = 1, x = (-b ± √(b²-4ac))/2a.
  The page renders markdown but not LaTeX, so "$b^2$" reaches the student
  looking exactly like that.
- Mention a relevant upcoming deadline when it genuinely helps.
`.trim();

  if (role === "teacher") {
    return `${base}

STAFF ACCESS: this user is verified staff. Staff-only documents (grading
rubrics, class performance, teacher notes) are included in your sources and you
may discuss them freely.`;
  }

  // No "do not reveal staff data" instruction, because staff documents are not
  // searched for this request. There is nothing present to withhold.
  return base;
}
