import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer (+ fontkit, yoga wasm) must not be bundled — load it
  // from node_modules at runtime in the Node route handler.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
