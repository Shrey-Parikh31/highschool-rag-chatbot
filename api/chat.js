// Vercel Serverless Function — the only place the Gemini key is ever read.
// Also runs under `npm run dev` via the dev-api plugin in vite.config.js,
// so local and production execute this exact file.

import { buildSystemPrompt, isSubject } from "./_data.js";
import { storesForRole } from "./_stores.js";
import { readBody, verifyRole, json } from "./_http.js";
import { rateLimit } from "./_limit.js";

// Auto-tracking alias: Google repoints it as new Flash models ship, so the app
// does not go stale. Pin an exact id in GEMINI_MODEL if a release regresses.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
// Free-tier Flash throws intermittent 503s. When the primary is saturated, a
// different model usually is not, so failover beats retrying the same one.
// Both are "-latest" aliases on purpose: Google repoints them as models ship and
// retires pinned ids. gemini-2.5-flash was rejected as deprecated on 2026-09-09,
// which is exactly the breakage a pinned version buys you.
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";

// Cost control. Measured usage is ~1200 input tokens (mostly retrieved document
// chunks) and ~240 output tokens per question, about $0.002 on Flash. The
// unbounded term is conversation history, so it is trimmed rather than capped:
// 40 messages of 4000 chars would be ~40k tokens, twenty times a normal turn.
const KEEP_MESSAGES = 12;
const MAX_CHARS = 2000;
const MAX_OUTPUT_TOKENS = 800;
const UPSTREAM_TIMEOUT_MS = 20000;

// Gemini 3.x Flash reasons before answering and bills those thoughts as output
// (~183 tokens, roughly 40% on top). Flash-Lite rejects the field outright with
// a 400, so support is discovered once per instance rather than assumed.
const thinkingUnsupported = new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  // Before anything that costs money.
  const limit = rateLimit(req);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return json(res, 429, {
      error: `That's a lot of questions at once! Give it ${limit.retryAfter} seconds and try again.`,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 500, { error: "GEMINI_API_KEY is not set on the server." });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Malformed JSON body." });
  }

  const { subjectId, messages, teacherPasscode } = body;

  if (!isSubject(subjectId)) return json(res, 400, { error: "Unknown subject." });
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(res, 400, { error: "Invalid message history." });
  }

  // Normalise rather than trust: drop anything that isn't a well-formed turn.
  // Only the tail is sent: a long session should cost the same as a short one.
  const contents = [];
  for (const m of messages.slice(-KEEP_MESSAGES)) {
    const text = typeof m?.text === "string" ? m.text.slice(0, MAX_CHARS) : null;
    if (!text) continue;
    contents.push({ role: m.from === "user" ? "user" : "model", parts: [{ text }] });
  }
  if (contents.length === 0) return json(res, 400, { error: "No usable messages." });

  // The access boundary. The client's claimed role is only a request.
  const role = verifyRole(teacherPasscode);

  // ...and it is enforced at RETRIEVAL: a student request carries only the
  // shared store, so staff documents are never searched and cannot enter the
  // model's context. This is why the prompt needs no "don't reveal" rule.
  let stores = [];
  try {
    stores = await storesForRole(apiKey, subjectId, role);
  } catch (err) {
    return json(res, 502, { error: `Could not reach the document store: ${err.message}` });
  }

  const system = buildSystemPrompt(role, subjectId, stores.length > 0);

  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
  if (stores.length) {
    payload.tools = [{ file_search: { file_search_store_names: stores } }];
  }

  const call = (model, withThinkingOff = !thinkingUnsupported.has(model)) => {
    const body = withThinkingOff
      ? { ...payload, generationConfig: { ...payload.generationConfig, thinkingConfig: { thinkingBudget: 0 } } }
      : payload;
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify(body),
    }).catch((err) => {
      // Normalise a timeout/abort into a 503-shaped result so the retry and
      // failover path treats a hang exactly like an overloaded model.
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return { ok: false, status: 503, json: async () => ({ error: { message: `${model} timed out` } }) };
      }
      throw err;
    });
  };

  // A model that rejects thinkingConfig answers fine without it, so learn that
  // once and stop sending it rather than failing the request.
  const callAdaptive = async (model) => {
    let r = await call(model);
    if (r.status === 400 && !thinkingUnsupported.has(model)) {
      thinkingUnsupported.add(model);
      r = await call(model, false);
    }
    return r;
  };

  try {
    // 503 means the model is momentarily busy, so a retry helps.
    // 429 means the daily quota for THAT model is gone, and the free tier allows
    // only 20 requests/day/model — so retrying it just burns a second request for
    // nothing. Because the quota is per-model, failing over to a different model
    // is what actually buys capacity.
    let used = MODEL;
    let upstream = await callAdaptive(used);
    const overloaded = (r) => r.status === 503;
    const exhausted = (r) => r.status === 429;

    if (overloaded(upstream)) {
      await new Promise((r) => setTimeout(r, 1000));
      upstream = await callAdaptive(used);
    }
    if ((overloaded(upstream) || exhausted(upstream)) && FALLBACK !== MODEL) {
      used = FALLBACK;
      upstream = await callAdaptive(used);
    }

    const data = await upstream.json();
    if (!upstream.ok) {
      // Surface the real upstream reason (quota, bad key, safety) but never the key.
      const raw = data?.error?.message || "Upstream API error.";
      const msg =
        upstream.status === 429
          ? "Daily free-tier quota is used up for today. The Gemini free tier allows 20 requests per day per model. Enable billing on the Google Cloud project to lift it."
          : raw;
      return json(res, upstream.status, { error: msg });
    }

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text || "").join("").trim();

    if (!text) {
      const reason = candidate?.finishReason;
      return json(res, 502, { error: `Model returned no text${reason ? ` (${reason})` : ""}.` });
    }

    // Which documents the answer was actually grounded in. Showing these is the
    // difference between "trust me" and "here's where I read it".
    const sources = [
      ...new Set(
        (candidate?.groundingMetadata?.groundingChunks || [])
          .map((c) => c.retrievedContext?.title)
          .filter(Boolean)
      ),
    ];

    return json(res, 200, { text, role, model: used, sources, grounded: stores.length > 0 });
  } catch (err) {
    return json(res, 502, { error: `Could not reach the model: ${err.message}` });
  }
}
