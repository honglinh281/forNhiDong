import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/compare': ['./scripts/**/*', './python/**/*', './requirements.txt', './.python-packages/**/*']
  },
  turbopack: {
    root: dirname
  },
  experimental: {
    serverActions: {}
  }
};

export default nextConfig;
