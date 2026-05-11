import { createServer } from "node:http";
import next from "next";
import { initWorkers } from "./workers-init";

// Ensure logs flush immediately (avoid block-buffered stdout in Docker).
process.stdout.write = process.stdout.write.bind(process.stdout);
console.log("[boot] misaka-web server starting...", { node: process.version, env: process.env.NODE_ENV });

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  console.log("[boot] preparing Next.js app...");
  await app.prepare();
  console.log("[boot] Next.js ready, starting HTTP listener...");

  // Start HTTP server FIRST so health checks pass even if workers fail.
  createServer((req, res) => handle(req, res)).listen(port, hostname, () =>
    console.log(`[boot] misaka-web ready on ${hostname}:${port}`),
  );

  // Workers (inventory poller + telegram bot) run async; failures must not crash boot.
  initWorkers().then(
    () => console.log("[boot] workers started"),
    (err) => console.error("[boot] worker init failed (non-fatal):", err),
  );
}

main().catch((err) => {
  console.error("[boot] fatal:", err);
  process.exit(1);
});
