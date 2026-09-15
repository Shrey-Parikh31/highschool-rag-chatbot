// Per-IP rate limiting.
//
// The site is public and unauthenticated, so /api/chat is the one endpoint that
// can spend real money on someone else's behalf. Measured cost is roughly
// $0.002 per question, so a script left running overnight is the only realistic
// way to blow a $5/month budget.
//
// ponytail: in-memory, so the window is per warm instance rather than global —
// Vercel may run several. That still turns "unbounded" into "bounded per
// instance", which is the difference that matters. Move to Vercel KV only if
// the bill says the instance count is actually defeating this.

const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_5MIN || 15);

/** ip -> array of request timestamps inside the window */
const hits = new Map();

export function clientIp(req) {
  // Vercel sets x-forwarded-for; take the first hop, which is the real client.
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
export function rateLimit(req) {
  const now = Date.now();
  const ip = clientIp(req);

  // Prune whole entries occasionally so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }

  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { allowed: false, retryAfter };
  }

  recent.push(now);
  hits.set(ip, recent);
  return { allowed: true };
}
