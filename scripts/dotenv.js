// Read this project's .env file.
//
// Values here deliberately OVERRIDE anything already in the environment. A
// GEMINI_API_KEY saved in the Windows user environment (for another project)
// once shadowed .env: Vite's loadEnv gives the OS variable priority, so the dev
// server and the seed script silently used a different — later revoked — key
// while .env held the right one. The project's own file is the more specific
// setting, so it wins.
import { readFileSync, existsSync } from "node:fs";

export function readDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    // Strip one pair of surrounding quotes, as dotenv does.
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}
