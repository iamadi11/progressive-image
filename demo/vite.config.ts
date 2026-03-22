import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sidecarPlugin } from 'vite-plugin-sidecar';

export default defineConfig({
  plugins: [
    react(),
    sidecarPlugin({
      include: 'public/**/*.{jpg,jpeg}',
      minSourceBytes: 0,
    }),
  ],
});
