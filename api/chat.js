// Vercel Serverless Function — the only place the Gemini key is ever read.
// Also runs under `npm run dev` via the dev-api plugin in vite.config.js,
// so local and production execute this exact file.

import { buildSystemPrompt } from "./_data.js";

// Auto-tracking alias: Google repoints it as new Flash models ship, so the app
// does not go stale. Pin an exact id in GEMINI_MODEL if a release regresses.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
// Free-tier Flash throws intermittent 503s. When the primary is saturated, a
// different model usually is not, so failover beats retrying the same one.
// Both are "-latest" aliases on purpose: Google repoints them as models ship and
// retires pinned ids. gemini-2.5-flash was rejected as deprecated on 2026-09-09,
// which is exactly the breakage a pinned version buys you.
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";

const MAX_MESSAGES = 40;
const MAX_CHARS = 4000;

async function readBody(req) {
  // Vercel populates req.body — as an object for parsed JSON, but as a raw
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  res.setHeader("Content-Type", "application/json");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set on the server." }));
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Malformed JSON body." }));
  }

  const { subjectId, messages, teacherPasscode } = body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Invalid message history." }));
  }

  // Normalise rather than trust: drop anything that isn't a well-formed turn.
  const contents = [];
  for (const m of messages) {
    const text = typeof m?.text === "string" ? m.text.slice(0, MAX_CHARS) : null;
    if (!text) continue;
    contents.push({
      role: m.from === "user" ? "user" : "model",
      parts: [{ text }],
    });
  }
  if (contents.length === 0) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "No usable messages." }));
  }

  // The access boundary. The client's claimed role is only a request; the server
  // decides. Without the passcode, staff data is never placed in the payload at
  // all, so no amount of prompt injection can surface it.
  // ponytail: shared passcode, swap for per-user auth when there are real accounts.
  const expected = process.env.TEACHER_PASSCODE;
  const role = expected && teacherPasscode === expected ? "teacher" : "student";

  // buildSystemPrompt owns subject validation (returns null on anything unknown),
  // so there is exactly one place that decides what a valid subject is.
  const system = buildSystemPrompt(role, subjectId);
  if (!system) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Unknown subject." }));
  }

  // Bound every upstream call. Without this a hung Gemini request hangs the
  // whole function until Vercel kills it at 60s, and the caller just sees a
  // dead connection. Three chained calls must still fit inside that budget.
  const UPSTREAM_TIMEOUT_MS = 12000;

  const call = (model) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }).catch((err) => {
      // Normalise a timeout/abort into a 503-shaped result so the retry and
      // failover path treats a hang exactly like an overloaded model.
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return { ok: false, status: 503, json: async () => ({ error: { message: `${model} timed out` } }) };
      }
      throw err;
    });

  try {
    // Retry the primary once, then fail over. Observed 503s on gemini-flash-latest
    // three times in ten minutes on the free tier — enough to ruin a live demo.
    let used = MODEL;
    let upstream = await call(used);
    const busy = (r) => r.status === 429 || r.status === 503;
    if (busy(upstream)) {
      await new Promise((r) => setTimeout(r, 1000));
      upstream = await call(used);
    }
    if (busy(upstream) && FALLBACK !== MODEL) {
      used = FALLBACK;
      upstream = await call(used);
    }

    const data = await upstream.json();
    if (!upstream.ok) {
      // Surface the real upstream reason (quota, bad key, safety) but never the key.
      res.statusCode = upstream.status;
      return res.end(JSON.stringify({ error: data?.error?.message || "Upstream API error." }));
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();

    if (!text) {
      const reason = data.candidates?.[0]?.finishReason;
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: `Model returned no text${reason ? ` (${reason})` : ""}.` }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ text, role, model: used }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: `Could not reach the model: ${err.message}` }));
  }
}
