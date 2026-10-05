// Upload syllabus files to a deployment, one subject at a time.
//
//   node scripts/publish-syllabi.mjs --remote https://your-app.vercel.app
//   node scripts/publish-syllabi.mjs --remote <url> math          one subject
//   node scripts/publish-syllabi.mjs --remote <url> --keep-old    leave old files in place
//
// Reads demo-syllabi/<subject>-syllabus.pdf (students) and
// <subject>-staff-notes.pdf (staff only). Any other folder works with --dir.
//
// After a successful upload it removes that subject's superseded .txt documents,
// so the assistant never cites the old seed text and the new PDF side by side.
// It never deletes a PDF, so re-running cannot throw away a real upload.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDotEnv } from "./dotenv.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
Object.assign(process.env, readDotEnv(path.join(ROOT, ".env")));

const args = process.argv.slice(2);
const takeFlag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const remote = takeFlag("--remote");
const dir = takeFlag("--dir") || path.join(ROOT, "demo-syllabi");
const keepOld = args.includes("--keep-old") && args.splice(args.indexOf("--keep-old"), 1);
const only = args[0];

const passcode = process.env.TEACHER_PASSCODE;
if (!remote || !passcode) {
  console.error("Usage: --remote <url>, and TEACHER_PASSCODE must be in .env");
  process.exit(1);
}
const base = remote.replace(/\/$/, "");
const SUBJECTS = ["math", "physics", "chemistry", "biology", "english", "history",
                  "geography", "cs", "economics", "french", "art", "pe"];

async function call(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...opts.headers, "x-teacher-passcode": passcode } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const upload = (subjectId, scope, file) =>
  call(`${base}/api/upload?${new URLSearchParams({ subjectId, scope, filename: path.basename(file) })}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: readFileSync(file),
  });

for (const id of only ? [only] : SUBJECTS) {
  if (!SUBJECTS.includes(id)) {
    console.error(`  ! unknown subject ${id}`);
    process.exitCode = 1;
    continue;
  }
  const student = path.join(dir, `${id}-syllabus.pdf`);
  const staff = path.join(dir, `${id}-staff-notes.pdf`);
  try {
    if (!existsSync(student)) throw new Error(`missing ${path.basename(student)}`);
    await upload(id, "shared", student);
    let line = `${path.basename(student)} -> students`;
    if (existsSync(staff)) {
      await upload(id, "staff", staff);
      line += `, ${path.basename(staff)} -> staff only`;
    }

    let removed = 0;
    if (!keepOld) {
      const { documents } = await call(`${base}/api/documents?subjectId=${id}`);
      for (const d of documents.filter((d) => d.displayName.toLowerCase().endsWith(".txt"))) {
        await call(`${base}/api/documents?${new URLSearchParams({ subjectId: id, scope: d.scope, name: d.name })}`,
                   { method: "DELETE" });
        removed += 1;
      }
    }
    console.log(`  ${id.padEnd(10)} ${line}${removed ? `, removed ${removed} old .txt` : ""}`);
  } catch (err) {
    console.error(`  ${id.padEnd(10)} FAILED: ${err.message}`);
    process.exitCode = 1;
  }
}
console.log("done.");
