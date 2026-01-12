import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared UI package
  transpilePackages: ["@aicomplice/ui"],

  // Redirects for combined Updates and Alerts stream
  async redirects() {
    return [
      {
        source: "/updates",
        destination: "/stream",
        permanent: true,
      },
      {
        source: "/alerts",
        destination: "/stream",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
