/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O conteudo em /content e lido no servidor em runtime: precisa ir junto no deploy.
  outputFileTracingIncludes: {
    '/**': ['./content/**/*.json'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
