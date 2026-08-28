import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js + Rapier wasm make a large single chunk; that is expected for
    // this client-only app.
    chunkSizeWarningLimit: 4000,
  },
})
