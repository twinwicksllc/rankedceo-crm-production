/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'images.pexels.com', 'images.unsplash.com'],
  },
  webpack: (config) => {
    // TypeScript path aliases are automatically handled by Next.js
    // No need for manual webpack configuration
    return config
  },
}

module.exports = nextConfig