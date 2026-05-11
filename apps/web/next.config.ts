import type { NextConfig } from "next";

// ── Production safety: fail the build if critical env vars are missing ─────────
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    '[next.config] NEXT_PUBLIC_API_URL is not set. ' +
    'Set it in your deployment environment variables to prevent silently falling back to localhost.'
  );
}

const nextConfig: NextConfig = {
  // Enable gzip/brotli compression for all responses
  compress: true,

  // Optimize image delivery with modern formats
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    // Tree-shake icon libraries — only import icons actually used,
    // instead of bundling the full lucide-react / react-icons packages.
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },
};

export default nextConfig;
