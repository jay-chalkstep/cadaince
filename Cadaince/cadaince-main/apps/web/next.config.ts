import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared UI package
  transpilePackages: ["@aicomplice/ui"],
};

export default nextConfig;
