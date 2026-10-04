import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true }, // must match the gateway's CORS_ALLOWED_ORIGIN
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    env: { VITE_API_URL: 'http://gateway.test/api' },
  },
});
