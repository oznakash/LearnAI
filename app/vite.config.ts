import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Build output is emitted to <repo-root>/dist/ so static hosts and
// repo-mirror deployers find it at the root without configuration.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '..', 'dist'),
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
