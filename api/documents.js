// Staff-only document manager: list and delete what has been uploaded.
//
// Without this, a file uploaded by mistake keeps being cited to students until
// someone rebuilds the store by hand.
//
//   GET    /api/documents?subjectId=math
//   DELETE /api/documents?subjectId=math&scope=staff&name=fileSearchStores/.../documents/...

import { isSubject } from "./_data.js";
import { findStore, listDocuments, deleteDocument, SCOPES } from "./_stores.js";
import { verifyRole, json } from "./_http.js";

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 500, { error: "GEMINI_API_KEY is not set on the server." });

  // Listing reveals staff-only filenames, and deleting changes what students are
  // told, so both are staff-only.
  if (verifyRole(req.headers["x-teacher-passcode"]) !== "teacher") {
    return json(res, 403, { error: "Staff access required." });
  }

  const url = new URL(req.url, "http://localhost");
  const subjectId = url.searchParams.get("subjectId");
  if (!isSubject(subjectId)) return json(res, 400, { error: "Unknown subject." });

  try {
    if (req.method === "GET") {
      const out = [];
      for (const scope of [SCOPES.SHARED, SCOPES.STAFF]) {
        const store = await findStore(apiKey, subjectId, scope);
        if (!store) continue;
        for (const d of await listDocuments(apiKey, store)) out.push({ ...d, scope });
      }
      return json(res, 200, { documents: out });
    }

    if (req.method === "DELETE") {
      const scope = url.searchParams.get("scope") === SCOPES.STAFF ? SCOPES.STAFF : SCOPES.SHARED;
      const name = url.searchParams.get("name") || "";
      const store = await findStore(apiKey, subjectId, scope);
      // The document name comes from the client, so it is only honoured if it
      // sits inside this subject's store. Otherwise a crafted name could delete
      // documents from another subject, or anything else on the API key.
      if (!store || !name.startsWith(`${store}/documents/`) || name.includes("..")) {
        return json(res, 400, { error: "That document does not belong to this subject." });
      }
      await deleteDocument(apiKey, name);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 502, { error: `Document store error: ${err.message}` });
  }
}
