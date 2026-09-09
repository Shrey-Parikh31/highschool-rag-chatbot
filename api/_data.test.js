// Run: node api/_data.test.js
// Guards the one property that matters: staff data must never reach a student
// payload. If buildSystemPrompt ever leaks it, this fails loudly.
import assert from "node:assert/strict";
import { buildSystemPrompt, COURSE_DATA } from "./_data.js";

const secrets = ["74", "98", "41", "Predicted weak area", "Grading split"];
const student = buildSystemPrompt("student", "math");
for (const s of secrets) {
  assert.ok(!student.includes(s), `student prompt leaked staff data: ${s}`);
}

const teacher = buildSystemPrompt("teacher", "math");
assert.ok(teacher.includes("74"), "teacher prompt is missing the class average");
assert.ok(teacher.includes("Predicted weak area"), "teacher prompt is missing notes");

// Anything that isn't exactly "teacher" is a student — no truthy-string bypass.
for (const role of ["Teacher", "TEACHER", "admin", "", null, undefined, true]) {
  assert.equal(buildSystemPrompt(role, "math"), student, `role ${role} was not treated as student`);
}

// Unknown subjects are rejected rather than silently fabricated.
assert.equal(buildSystemPrompt("student", "../../etc/passwd"), null);
assert.equal(buildSystemPrompt("student", "__proto__"), null);

// Every subject the UI offers must resolve to a prompt.
assert.ok(buildSystemPrompt("student", "pe").includes("Physical Education"));
assert.ok(Object.keys(COURSE_DATA).length > 0);

console.log("ok — staff data stays server-side for students");
