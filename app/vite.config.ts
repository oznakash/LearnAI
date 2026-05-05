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
  // app/src/views/Legal.tsx imports the canonical legal text from
  // `docs/legal/{privacy,terms}.md` via Vite's `?raw` query. docs/
  // lives at the workspace root, one level above app/, so we widen
  // the file-access allowlist. Production build doesn't need this;
  // dev-server + vitest do.
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        // Vitest reuses the dev server, so the `server.fs.allow` above
        // is what governs MD imports during tests.
      },
    },
  },
})
