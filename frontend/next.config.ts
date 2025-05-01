import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Define fallback values for environment variables
    // These will be overridden by .env.local in development
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000',
  },
  // Enable React strict mode for better error checking
  reactStrictMode: true,
};

export default nextConfig;