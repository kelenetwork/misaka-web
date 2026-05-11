import { createServer } from "node:http";
import next from "next";
import { initWorkers } from "./workers-init";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  await initWorkers();
  createServer((req, res) => handle(req, res)).listen(port, hostname, () =>
    console.log(`misaka-web ready on ${hostname}:${port}`),
  );
}

main().catch((err) => {
  console.error("misaka-web fatal:", err);
  process.exit(1);
});
