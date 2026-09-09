import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Vercel runs api/*.js for us in production. Locally, mount the same handler on
// the dev server so `npm run dev` exercises identical code — no `vercel dev`,
// no second process, no drift between local and deployed behaviour.
function devApi(env) {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res, next) => {
        Object.assign(process.env, env); // .env is not on process.env under Vite
        try {
          // Cache-bust so edits to api/chat.js apply without restarting the server.
          const mod = await server.ssrLoadModule(`/api/chat.js?t=${Date.now()}`);
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
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ""))],
}));
