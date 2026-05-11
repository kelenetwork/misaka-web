import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Custom server (server/index.ts) is incompatible with output: "standalone".
  // We bundle the full app into the runtime image instead.
};

export default nextConfig;
