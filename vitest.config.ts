import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { pool: "threads", poolOptions: { threads: { singleThread: true } } }, resolve: { alias: { "@": path.resolve(__dirname, ".") } } });
