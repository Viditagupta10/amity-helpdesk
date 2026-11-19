import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// "/api" ki saari requests backend (port 4000) ko forward hoti hain, isliye CORS ka jhanjhat nahi.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
