// Shared request/response helpers for the API routes.
// Both chat.js and upload.js need identical body parsing and an identical role
// check, duplicating either would let the two drift apart, and the role check
// is the security boundary, so it gets exactly one implementation.

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(payload));
}

export async function readBody(req) {
  // Vercel populates req.body, as an object for parsed JSON, but as a raw
  // string on some content types. Handle both BEFORE touching the stream:
  // Vercel has already consumed it, so iterating it there never emits "end"
  // and the function hangs until the platform timeout.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString("utf8")) : {};
    return req.body;
  }
  // Vite's dev middleware does not body-parse, so read the stream there.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks.map(Buffer.from)).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/** Read a request stream to a Buffer, capped. Used for file uploads. */
export async function readRaw(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map(Buffer.from));
}

/**
 * The single place a role is decided. The client's claim is ignored entirely;
 * only a passcode matching the server's env var grants staff access, and an
 * unset TEACHER_PASSCODE means teacher mode is unreachable rather than open.
 */
export function verifyRole(teacherPasscode) {
  const expected = process.env.TEACHER_PASSCODE;
  // ponytail: shared passcode, swap for per-user auth when there are real accounts.
  return expected && teacherPasscode === expected ? "teacher" : "student";
}
