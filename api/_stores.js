// Gemini File Search Stores — the retrieval layer.
//
// One store per (subject, scope). Scope is the access level:
//   <subjectId>--shared  documents any student may see (syllabus, deadlines)
//   <subjectId>--staff   staff-only documents (rubrics, answer keys, notes)
//
// There is deliberately no database. A store's displayName IS the registry:
// Google returns it when listing stores, so the naming convention above is
// enough to find one. That removes Pinecone/Chroma and a schema to migrate.

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const SCOPES = { SHARED: "shared", STAFF: "staff" };

export function storeLabel(subjectId, scope) {
  return `${subjectId}--${scope}`;
}

// Warm serverless instances reuse this; a cold start just re-lists. Listing is
// cheap and not subject to the generateContent daily cap.
let cache = null;

async function api(path, { method = "GET", apiKey, body } = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      "x-goog-api-key": apiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `File Search API ${res.status}`);
  return data;
}

/** displayName -> resource name, for every store on the project. */
export async function listStores(apiKey, { refresh = false } = {}) {
  if (cache && !refresh) return cache;
  const out = {};
  let pageToken;
  // Paginate: a school with many subjects will exceed one page.
  do {
    const q = pageToken ? `fileSearchStores?pageToken=${encodeURIComponent(pageToken)}` : "fileSearchStores";
    const data = await api(q, { apiKey });
    for (const s of data.fileSearchStores || []) {
      if (s.displayName) out[s.displayName] = s.name;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  cache = out;
  return out;
}

/** Resource name for a store, or null when nothing has been uploaded for it. */
export async function findStore(apiKey, subjectId, scope) {
  const stores = await listStores(apiKey);
  const label = storeLabel(subjectId, scope);
  if (stores[label]) return stores[label];
  // A store created by another instance since this cache was filled.
  const fresh = await listStores(apiKey, { refresh: true });
  return fresh[label] || null;
}

/** Resource name for a store, creating it if this is the first upload. */
export async function ensureStore(apiKey, subjectId, scope) {
  const existing = await findStore(apiKey, subjectId, scope);
  if (existing) return existing;

  const label = storeLabel(subjectId, scope);
  const created = await api("fileSearchStores", {
    method: "POST",
    apiKey,
    body: { displayName: label },
  });
  if (cache) cache[label] = created.name;
  return created.name;
}

/**
 * Stores a role is allowed to search, most privileged last.
 *
 * This is the access boundary for retrieval: a student's request carries only
 * the shared store, so staff documents are not merely withheld from the answer
 * — they are never searched, and cannot appear in the model's context at all.
 */
export async function storesForRole(apiKey, subjectId, role) {
  const shared = await findStore(apiKey, subjectId, SCOPES.SHARED);
  const names = shared ? [shared] : [];
  if (role === "teacher") {
    const staff = await findStore(apiKey, subjectId, SCOPES.STAFF);
    if (staff) names.push(staff);
  }
  return names;
}

/**
 * Push one document into a store.
 *
 * The metadata part MUST be a plain string field, not a Blob. Node's FormData
 * attaches a filename to every Blob, and Google's parser then counts metadata
 * as a second file and rejects the request with "Multipart body contains
 * multiple files." curl's -F does not set that filename, which is why the
 * equivalent curl command works.
 */
export async function uploadDocument(apiKey, store, filename, data, mimeType, { timeoutMs = 55000 } = {}) {
  const form = new FormData();
  form.append("metadata", JSON.stringify({ display_name: filename }));
  form.append("file", new Blob([data], { type: mimeType }), filename);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/${store}:uploadToFileSearchStore`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Upload failed (HTTP ${res.status})`);
  return body;
}

/** Documents in one store, newest first. */
export async function listDocuments(apiKey, store) {
  const docs = [];
  let pageToken;
  do {
    const q = `${store}/documents${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const data = await api(q, { apiKey });
    for (const d of data.documents || []) {
      docs.push({
        name: d.name,
        displayName: d.displayName,
        sizeBytes: Number(d.sizeBytes || 0),
        createTime: d.createTime,
        state: d.state,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs.sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)));
}

/**
 * Delete one document. The caller must already have checked the document
 * belongs to a store it is allowed to touch — see api/documents.js.
 * force=true also removes its indexed chunks, so it stops being cited at once.
 */
export async function deleteDocument(apiKey, documentName) {
  await api(`${documentName}?force=true`, { method: "DELETE", apiKey });
}
