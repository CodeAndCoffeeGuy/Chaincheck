import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// Vite configuration for ChainCheck frontend
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-service-worker',
      closeBundle() {
        // Copy service worker to dist folder
        copyFileSync(
          join(__dirname, 'public/sw.js'),
          join(__dirname, 'dist/sw.js')
        )
      },
    },
  ],
  server: {
    port: 3000,
    host: true,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
      clientPort: 3000,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  publicDir: 'public',
})

