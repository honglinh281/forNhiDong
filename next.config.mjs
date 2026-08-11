import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/compare': ['./scripts/**/*', './python/**/*', './requirements.txt', './.python-packages/**/*']
  },
  experimental: {
    serverActions: {}
  },
  webpack(config) {
    config.resolve.alias['@'] = path.join(projectRoot, 'src');
    return config;
  }
};

export default nextConfig;
