import type { NextConfig } from "next";

/**
 * Security Headers Configuration
 * - CSP: Prevents XSS, injection attacks
 * - HSTS: Forces HTTPS
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME sniffing
 */
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL;
let appOrigin: string | null = null;

if (rawAppUrl) {
  try {
    appOrigin = new URL(rawAppUrl).origin;
  } catch {
    appOrigin = null;
  }
}

const allowUnsafeEval = process.env.NODE_ENV !== 'production' || process.env.CSP_ALLOW_UNSAFE_EVAL === 'true';
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(allowUnsafeEval ? ["'unsafe-eval'"] : []),
  'https://www.googletagmanager.com',
];

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc.join(' ')}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://img.vietqr.io https://www.googleapis.com https://oauth2.googleapis.com https://provinces.open-api.vn https://accounts.google.com",
      "frame-src 'self' https://accounts.google.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  },
];

const nextConfig: NextConfig = {
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,

  // Security headers
  async headers() {
    const headersRules = [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];

    if (appOrigin) {
      headersRules.push({
        // CORS for API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: appOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      });
    }

    return headersRules;
  },

  // Powered by header removal (hide Next.js signature)
  poweredByHeader: false,

  // Image optimization config
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'img.vietqr.io',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
