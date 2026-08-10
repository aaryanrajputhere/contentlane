import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: `${frontendDir}/../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js`,
          dest: 'ffmpeg',
        },
        {
          src: `${frontendDir}/../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm`,
          dest: 'ffmpeg',
        },
      ],
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
