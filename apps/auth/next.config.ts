import type { NextConfig } from "next";

// ── Production safety: fail the build if critical env vars are missing ─────────
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    '[auth/next.config] NEXT_PUBLIC_API_URL is not set. ' +
    'Set it in your deployment environment variables to prevent silently falling back to localhost.',
  );
}

const nextConfig: NextConfig = {
  compress: true,
  images: { formats: ['image/avif', 'image/webp'] },
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },
};

export default nextConfig;
