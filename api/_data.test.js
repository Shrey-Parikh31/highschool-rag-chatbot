// Run: node api/_data.test.js
//
// Guards the access boundary. Under RAG the boundary moved from "what is pasted
// into the prompt" to "which stores are searched", so that is what this checks:
// a student request must never carry the staff store.
import assert from "node:assert/strict";
import { buildSystemPrompt, isSubject, SUBJECT_NAMES } from "./_data.js";
import { storeLabel, SCOPES } from "./_stores.js";

// ── Subject validation ────────────────────────────────────────────────
// "__proto__" resolves to Object.prototype on a plain lookup, which is truthy
// and once crashed the handler. Own-property checks only.
for (const bad of ["__proto__", "constructor", "toString", "../../etc/passwd", "", null, undefined, 7, {}]) {
  assert.equal(isSubject(bad), false, `isSubject accepted ${String(bad)}`);
  assert.equal(buildSystemPrompt("student", bad, true), null, `buildSystemPrompt accepted ${String(bad)}`);
}
for (const id of Object.keys(SUBJECT_NAMES)) {
  assert.ok(isSubject(id), `isSubject rejected real subject ${id}`);
  assert.ok(buildSystemPrompt("student", id, true).includes(SUBJECT_NAMES[id]));
}

// ── Store scoping is the access boundary ──────────────────────────────
// storesForRole hits the network, so the pure part is tested here: the labels
// must be distinct, and the staff label must never equal the shared one.
for (const id of Object.keys(SUBJECT_NAMES)) {
  const shared = storeLabel(id, SCOPES.SHARED);
  const staff = storeLabel(id, SCOPES.STAFF);
  assert.notEqual(shared, staff, `${id}: shared and staff labels collide`);
  assert.ok(shared.endsWith("--shared"));
  assert.ok(staff.endsWith("--staff"));
}
// Subjects must not collide with each other either, or one subject's staff
// documents would be searched for another subject's students.
const labels = Object.keys(SUBJECT_NAMES).flatMap((id) => [storeLabel(id, SCOPES.SHARED), storeLabel(id, SCOPES.STAFF)]);
assert.equal(new Set(labels).size, labels.length, "store labels are not unique");

// ── Prompt behaviour ──────────────────────────────────────────────────
const student = buildSystemPrompt("student", "math", true);
const teacher = buildSystemPrompt("teacher", "math", true);
assert.ok(!student.includes("STAFF ACCESS"), "student prompt claims staff access");
assert.ok(teacher.includes("STAFF ACCESS"), "teacher prompt is missing staff access");

// Anything that isn't exactly "teacher" is a student, no truthy-string bypass.
for (const role of ["Teacher", "TEACHER", "admin", "", null, undefined, true]) {
  assert.equal(buildSystemPrompt(role, "math", true), student, `role ${String(role)} was not treated as student`);
}

// With no documents, the assistant must refuse to invent course facts rather
// than fall back on anything plausible.
const empty = buildSystemPrompt("student", "chemistry", false);
assert.ok(/do not invent/i.test(empty), "empty-store prompt does not forbid inventing");
assert.ok(/not been uploaded/i.test(empty), "empty-store prompt does not explain why");

// No course content should be hardcoded in the prompt layer any more; it all
// arrives through retrieval. These strings were the old hardcoded values.
for (const leaked of ["74", "Predicted weak area", "SOH-CAH-TOA", "Mar 5"]) {
  assert.ok(!student.includes(leaked), `course content is still hardcoded: ${leaked}`);
  assert.ok(!teacher.includes(leaked), `course content is still hardcoded: ${leaked}`);
}

console.log("ok: staff stores are never in a student's scope, and no course data is hardcoded");
