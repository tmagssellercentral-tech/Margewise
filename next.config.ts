import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // CSV uploads (ad spend, courier invoices) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};
export default nextConfig;
