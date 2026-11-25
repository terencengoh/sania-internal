import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works at https://<user>.github.io/sania-internal/
export default defineConfig({
  base: './',
  plugins: [react()],
});
