// Vercel Serverless Function, the only place the Gemini key is ever read.
// Also runs under `npm run dev` via the dev-api plugin in vite.config.js,
// so local and production execute this exact file.

import { buildSystemPrompt, isSubject } from "./_data.js";
import { storesForRole } from "./_stores.js";
import { readBody, verifyRole, json } from "./_http.js";
import { rateLimit } from "./_limit.js";

// Flash-Lite answers first: ~2.5x cheaper per question than Flash today and
// ~5x after 2027-01-01, when Flash's price doubles. The chatbot runs on a
// shared $5 prepaid balance capped at $2.50/month, and syllabus lookups do not
// need the bigger model. Flash is the fallback when Lite is busy or refuses.
//
// Both are "-latest" aliases on purpose: Google repoints them as models ship and
// retires pinned ids. gemini-2.5-flash was rejected as deprecated on 2026-09-09,
// which is exactly the breakage a pinned version buys you.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-latest";

// Cost control. Measured usage is ~1200 input tokens (mostly retrieved document
// chunks) and ~240 output tokens per question, about $0.002 on Flash. The
// unbounded term is conversation history, so it is trimmed rather than capped:
// 40 messages of 4000 chars would be ~40k tokens, twenty times a normal turn.
const KEEP_MESSAGES = 12;
const MAX_CHARS = 2000;
const MAX_OUTPUT_TOKENS = 800;
const UPSTREAM_TIMEOUT_MS = 20000; // until response headers arrive
const STREAM_MAX_MS = 45000;       // whole answer; under Vercel's 60s function cap

// Gemini 3.x Flash reasons before answering and bills those thoughts as output
// (~183 tokens, roughly 40% on top). Flash-Lite rejects the field outright with
// a 400, so it starts in this set to skip that wasted round trip on every cold
// start; any other model that rejects it is learned at runtime.
const thinkingUnsupported = new Set(["gemini-flash-lite-latest"]);

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

  // Connect and wait for response HEADERS only. Status arrives before any text,
  // so every retry/failover decision is made before a byte reaches the student.
  // The connect timeout is cleared once headers arrive; a stream is then bounded
  // separately by STREAM_MAX_MS, so a long answer is not cut off at 20s.
  const connect = async (model, withThinkingOff = !thinkingUnsupported.has(model)) => {
    const body = withThinkingOff
      ? { ...payload, generationConfig: { ...payload.generationConfig, thinkingConfig: { thinkingBudget: 0 } } }
      : payload;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: ac.signal,
          body: JSON.stringify(body),
        }
      );
      return { r, ac };
    } catch (err) {
      // A hang is treated exactly like an overloaded model by the failover below.
      if (err.name === "AbortError" || err.name === "TimeoutError") {
        return { r: { ok: false, status: 503, body: null, json: async () => ({ error: { message: `${model} timed out` } }) }, ac };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
  const discard = (attempt) => attempt?.r?.body?.cancel?.().catch(() => {});

  // A model that rejects thinkingConfig answers fine without it, so learn that
  // once and stop sending it rather than failing the request.
  const connectAdaptive = async (model) => {
    let a = await connect(model);
    if (a.r.status === 400 && !thinkingUnsupported.has(model)) {
      thinkingUnsupported.add(model);
      discard(a);
      a = await connect(model, false);
    }
    return a;
  };

  let used = MODEL;
  let attempt;
  try {
    // 503 means the model is momentarily busy, so a retry helps.
    // 429 means the daily quota for THAT model is gone, and the free tier allows
    // only 20 requests/day/model, so retrying it just burns a second request for
    // nothing. Because the quota is per-model, failing over to a different model
    // is what actually buys capacity.
    attempt = await connectAdaptive(used);
    const overloaded = (a) => a.r.status === 503;
    const exhausted = (a) => a.r.status === 429;
    // A 400 that survives the thinking-config retry means this model refuses the
    // request shape (e.g. a model without file_search support). Rejected
    // requests are not billed, so trying the other model costs nothing.
    const refused = (a) => a.r.status === 400;

    if (overloaded(attempt)) {
      discard(attempt);
      await new Promise((r) => setTimeout(r, 1000));
      attempt = await connectAdaptive(used);
    }
    if ((overloaded(attempt) || exhausted(attempt) || refused(attempt)) && FALLBACK !== MODEL) {
      discard(attempt);
      used = FALLBACK;
      attempt = await connectAdaptive(used);
    }
  } catch (err) {
    return json(res, 502, { error: `Could not reach the model: ${err.message}` });
  }

  if (!attempt.r.ok) {
    // Still before any streaming, so this is an ordinary JSON error response.
    const data = await attempt.r.json().catch(() => ({}));
    const raw = data?.error?.message || "Upstream API error.";
    const msg =
      attempt.r.status === 429
        ? "Daily free-tier quota is used up for today. The Gemini free tier allows 20 requests per day per model. Enable billing on the Google Cloud project to lift it."
        : raw;
    return json(res, attempt.r.status, { error: msg });
  }

  // From here the reply streams to the browser as newline-delimited JSON:
  //   {"t":"delta","text":"..."}  repeated
  //   {"t":"done", role, model, sources, grounded}   or   {"t":"error","error":"..."}
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no"); // stop proxies holding the stream back
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`);

  const hardStop = setTimeout(() => attempt.ac.abort(), STREAM_MAX_MS);
  const decoder = new TextDecoder();
  const sources = new Set();
  let buf = "";
  let text = "";
  let finish;
  let interrupted = false;

  try {
    for await (const chunk of attempt.r.body) {
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue; // SSE framing: blank lines, comments
        let evt;
        try {
          evt = JSON.parse(line.slice(5));
        } catch {
          continue;
        }
        const cand = evt.candidates?.[0];
        const delta = (cand?.content?.parts || []).map((p) => (p.thought ? "" : p.text || "")).join("");
        if (delta) {
          text += delta;
          send({ t: "delta", text: delta });
        }
        // Grounding arrives in the later chunks; collect it as it comes.
        for (const g of cand?.groundingMetadata?.groundingChunks || []) {
          if (g.retrievedContext?.title) sources.add(g.retrievedContext.title);
        }
        if (cand?.finishReason) finish = cand.finishReason;
      }
    }
  } catch {
    interrupted = true;
  } finally {
    clearTimeout(hardStop);
  }

  if (!text.trim()) {
    send({
      t: "error",
      error: interrupted
        ? "The answer was interrupted. Please try again."
        : `Model returned no text${finish ? ` (${finish})` : ""}.`,
    });
    return res.end();
  }

  // Which documents the answer was actually grounded in. Showing these is the
  // difference between "trust me" and "here's where I read it".
  send({ t: "done", role, model: used, sources: [...sources], grounded: stores.length > 0, truncated: interrupted });
  return res.end();
}
