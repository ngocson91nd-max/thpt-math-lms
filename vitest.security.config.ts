import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/security/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false, // mutation.test.ts sửa database, không chạy song song
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: loadEnv('security', process.cwd(), ''), // đọc .env.security
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
