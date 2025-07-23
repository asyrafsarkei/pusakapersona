import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  base: '/pusakapersona/',

  // 🛠 Add this 'build' section below:
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`
      }
    }
  },

  server: {
    host: true,
    port: 5173
  }
});
