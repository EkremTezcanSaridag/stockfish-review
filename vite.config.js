import { defineConfig } from 'vite'

export default defineConfig({
  base: '/stockfish-review/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
