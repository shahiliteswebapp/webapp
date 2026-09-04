import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer (+ fontkit, yoga wasm) must not be bundled — load it
  // from node_modules at runtime in the Node route handler.
  serverExternalPackages: ["@react-pdf/renderer"],

  // The PDF fonts are read from disk at runtime (src/lib/pdf/fonts.ts), so
  // they aren't auto-traced. Force them into the serverless function bundle.
  outputFileTracingIncludes: {
    "/api/quotations": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
