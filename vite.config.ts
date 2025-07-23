import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  root: 'client',
  plugins: [react()],
  base: "/pusakapersona/",
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: true, // This makes the server accessible externally
    port: 5173, // Ensure this is the port you want to use
  }
});
