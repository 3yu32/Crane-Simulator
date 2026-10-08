import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Production-only Content-Security-Policy. The deployed site holds the
// visitor's own Gemini key in the page, so lock down where scripts can come
// from and where data can be sent: only this origin, plus Google's Gemini API
// (and the font hosts the 3D text loader may use). Dev is left alone — Vite's
// HMR needs inline scripts and websockets.
const CSP = [
  "default-src 'self'",
  // blob: is needed by the 3D text renderer's web workers (troika).
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "connect-src 'self' data: blob: https://generativelanguage.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function productionCsp(): Plugin {
  return {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/; the deploy workflow
  // sets VITE_BASE accordingly. Locally it stays "/".
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), productionCsp()],
  build: {
    // three.js + Rapier wasm make a large single chunk; that is expected for
    // this client-only app.
    chunkSizeWarningLimit: 4000,
  },
})
