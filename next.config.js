/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep data-testid attributes in production so QA smoke tests can target them.
  // Next.js SWC strips these by default in production builds.
  compiler: {
    reactRemoveProperties: false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@swc/core-linux-x64-gnu",
      "node_modules/@swc/core-linux-x64-musl",
      "node_modules/@esbuild/linux-x64",
    ],
  },
  // "@/*" is already resolved via tsconfig.json paths, which Turbopack reads natively.
  turbopack: {},
};

module.exports = nextConfig;
