import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same-origin API in development too, mirroring the nginx setup in docker compose.
    proxy: { '/api': { target: 'http://localhost:3000', xfwd: true } },
  },
});
