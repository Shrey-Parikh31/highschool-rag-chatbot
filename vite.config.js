import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readDotEnv } from "./scripts/dotenv.js";

// Vercel runs api/*.js for us in production. Locally, mount the same handler on
// the dev server so `npm run dev` exercises identical code — no `vercel dev`,
// no second process, no drift between local and deployed behaviour.
function devApi(env) {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = (req.url || "").split("?")[0];
        if (!route.startsWith("/api/")) return next();
        const name = route.slice(5).replace(/[^a-z0-9-]/gi, "");
        if (!name) return next();

        Object.assign(process.env, env); // .env is not on process.env under Vite
        try {
          // Cache-bust so edits to the handler apply without restarting the server.
          const mod = await server.ssrLoadModule(`/api/${name}.js?t=${Date.now()}`);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[dev-api] ${err.stack || err.message}`);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Dev API error: ${err.message}` }));
          }
        }
        void next;
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  // loadEnv lets an OS-level variable beat .env; for the API handlers the
  // project's .env must win (scripts/dotenv.js explains the incident).
  plugins: [react(), devApi({ ...loadEnv(mode, process.cwd(), ""), ...readDotEnv(".env") })],
}));
