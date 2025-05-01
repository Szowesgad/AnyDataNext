/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',  // Enables static HTML export
  distDir: 'out',    // Directory where the export will be generated
  images: {
    unoptimized: true,  // Required for static export
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  // GitHub Pages uses a repo name as a sub-path, so we need to handle this
  basePath: process.env.NODE_ENV === 'production' ? '/AnyDataset' : '',
};

module.exports = nextConfig;