import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Default build inlines EVERYTHING (JS, CSS, and — via embedded-assets.js —
// all textures/models/images as data URLs) into one self-contained index.html
// that runs from file:// with no server. Dev server is unchanged.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: { port: 5193, host: true },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 100000,
  },
})
