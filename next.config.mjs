/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/compare': ['./scripts/**/*', './python/**/*', './requirements.txt', './.python-packages/**/*']
  },
  experimental: {
    serverActions: {}
  }
};

export default nextConfig;
