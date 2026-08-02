import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path
  // (e.g. GitHub Pages at /MLnode-editor/), not just the domain root.
  base: './',
  plugins: [react()],
});
