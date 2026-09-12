// Teacher-only document upload.
//
// The browser POSTs the file as the raw request body with metadata in the query
// string, so no multipart parser is needed on this side. Gemini's ingest
// endpoint does want multipart, which Node's built-in FormData/Blob build
// without a dependency.

import { isSubject, SUBJECT_NAMES } from "./_data.js";
import { ensureStore, uploadDocument, SCOPES } from "./_stores.js";
import { readRaw, verifyRole, json } from "./_http.js";

// Vercel's Hobby plan rejects request bodies over 4.5MB before this function
// ever runs, so cap below that and give a clear message instead of a platform error.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 500, { error: "GEMINI_API_KEY is not set on the server." });

  // Uploading changes what every student is told, so this is staff-only and the
  // passcode is checked before a single byte is read.
  if (verifyRole(req.headers["x-teacher-passcode"]) !== "teacher") {
    return json(res, 403, { error: "Staff access required to upload documents." });
  }

  const url = new URL(req.url, "http://localhost");
  const subjectId = url.searchParams.get("subjectId");
  const scope = url.searchParams.get("scope") === SCOPES.STAFF ? SCOPES.STAFF : SCOPES.SHARED;
  const rawName = (url.searchParams.get("filename") || "document").slice(0, 120);
  // Strip anything path-like; this becomes a display name students can see.
  const filename = rawName.replace(/[^\w.\- ]+/g, "_");

  if (!isSubject(subjectId)) return json(res, 400, { error: "Unknown subject." });

  const contentType = (req.headers["content-type"] || "").split(";")[0].trim();
  if (!ALLOWED[contentType]) {
    return json(res, 415, {
      error: `Unsupported file type "${contentType || "unknown"}". Upload a PDF, DOCX, TXT, MD or HTML file.`,
    });
  }

  let buf;
  try {
    buf = await readRaw(req, MAX_BYTES);
  } catch (err) {
    if (err.message === "TOO_LARGE") {
      return json(res, 413, { error: "File is larger than 4MB. Split it or upload a smaller export." });
    }
    return json(res, 400, { error: `Could not read the upload: ${err.message}` });
  }
  if (!buf.length) return json(res, 400, { error: "The uploaded file is empty." });

  try {
    const store = await ensureStore(apiKey, subjectId, scope);
    // Chunking and embedding a large PDF is slow; the helper allows more time
    // than a chat call for that reason.
    await uploadDocument(apiKey, store, filename, buf, contentType);

    return json(res, 200, {
      ok: true,
      filename,
      subject: SUBJECT_NAMES[subjectId],
      scope,
      visibleTo: scope === SCOPES.STAFF ? "staff only" : "all students",
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return json(res, 504, { error: "The document took too long to process. Try a smaller file." });
    }
    return json(res, 502, { error: `Upload failed: ${err.message}` });
  }
}
