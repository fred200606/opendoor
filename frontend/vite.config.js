import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Tailwind CSS 4 for the IPT look (Decision 2026-10-21b); src/index.css imports it.
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true }, // must match the gateway's CORS_ALLOWED_ORIGIN
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    env: { VITE_API_URL: 'http://gateway.test/api' },
    // The long form and filter tests click through many steps; 5 s was not enough on a busy machine.
    testTimeout: 15_000,
  },
});
