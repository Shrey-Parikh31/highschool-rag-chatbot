// Credential diagnostic. Inert unless ENABLE_DIAG=1 is set on the server AND
// the caller presents the staff passcode, so it stays dark in normal operation.
//
// Written while tracing why production saw zero File Search Stores while a
// laptop saw seven with a byte-identical key. It reports a key fingerprint and
// never the key itself.
import { createHash } from "node:crypto";
import { listStores } from "./_stores.js";
import { verifyRole, json } from "./_http.js";

export default async function handler(req, res) {
  if (process.env.ENABLE_DIAG !== "1") return json(res, 404, { error: "Not found." });
  if (verifyRole(req.headers["x-teacher-passcode"]) !== "teacher") {
    return json(res, 403, { error: "Staff only." });
  }
  const apiKey = process.env.GEMINI_API_KEY || "";
  // Fingerprint, never the key itself.
  const fp = createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
  // Does a direct GET of a known store work, even though LIST comes back empty?
  // If it does, the stores exist and are reachable, and only listing is scoped.
  let direct = {};
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/mathshared-zpchpof17fnz",
      { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15000) }
    );
    direct = { status: r.status, bodyStart: (await r.text()).slice(0, 260) };
  } catch (e) {
    direct = { fetchError: e.name + ": " + e.message };
  }

  // Raw, unwrapped call so we see exactly what Google returns from this region.
  let raw = {};
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/fileSearchStores", {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.text();
    raw = { status: r.status, bodyStart: body.slice(0, 400) };
  } catch (e) {
    raw = { fetchError: e.name + ": " + e.message };
  }

  // Can this runtime create a store and then see it? If yes, the credential
  // resolves to a different tenant here than it does from a laptop.
  let roundTrip = {};
  if (req.headers["x-diag-create"] === "1") {
    try {
      const c = await fetch("https://generativelanguage.googleapis.com/v1beta/fileSearchStores", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "vercel-roundtrip-probe" }),
        signal: AbortSignal.timeout(15000),
      });
      const created = await c.json();
      const l = await fetch("https://generativelanguage.googleapis.com/v1beta/fileSearchStores", {
        headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15000),
      });
      const listed = await l.json();
      roundTrip = {
        createStatus: c.status,
        createdName: created?.name || created?.error?.message?.slice(0, 120),
        listedAfterCreate: (listed.fileSearchStores || []).map((x) => x.displayName),
      };
      // x-diag-keep leaves the probe store behind so the other environment can
      // try to see it, that tells us whether the isolation is symmetric.
      if (created?.name && req.headers["x-diag-keep"] !== "1") {
        await fetch(`https://generativelanguage.googleapis.com/v1beta/${created.name}?force=true`, {
          method: "DELETE", headers: { "x-goog-api-key": apiKey },
        });
      }
    } catch (e) {
      roundTrip = { error: e.name + ": " + e.message };
    }
  }

  // Remove probe stores this diagnostic left behind. Prefix-restricted so it
  // can never touch a real <subject>--<scope> store.
  let cleaned = [];
  if (req.headers["x-diag-cleanup"] === "1") {
    const l = await (await fetch("https://generativelanguage.googleapis.com/v1beta/fileSearchStores", {
      headers: { "x-goog-api-key": apiKey },
    })).json();
    for (const st of l.fileSearchStores || []) {
      if (!String(st.displayName || "").startsWith("vercel-roundtrip-probe")) continue;
      await fetch(`https://generativelanguage.googleapis.com/v1beta/${st.name}?force=true`, {
        method: "DELETE", headers: { "x-goog-api-key": apiKey },
      });
      cleaned.push(st.displayName);
    }
  }

  try {
    const stores = await listStores(apiKey, { refresh: true });
    return json(res, 200, {
      keyFingerprint: fp,
      keyLength: apiKey.length,
      keyPrefix: apiKey.slice(0, 3),
      storeCount: Object.keys(stores).length,
      storeLabels: Object.keys(stores),
      raw,
      direct,
      roundTrip,
      cleaned,
    });
  } catch (err) {
    return json(res, 200, { keyFingerprint: fp, keyLength: apiKey.length, keyPrefix: apiKey.slice(0, 3), listError: err.message });
  }
}
