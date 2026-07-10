import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    ...(process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {}),
    // `vite dev` only serves the React app — /api/* lives in Cloudflare Pages
    // Functions, which don't run under plain Vite. Proxy those requests to a
    // `wrangler pages dev` instance running alongside it on WRANGLER_PORT
    // (default 8788; see infra/cloudflare.md for the full local-dev command),
    // so the storefront AND the admin portal both work against real data
    // while still using Vite's fast live-reload for the UI.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.WRANGLER_PORT || 8788}`,
        changeOrigin: true,
      },
    },
  },
})
