import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': {
        // # FIX: Proxy the exact FastAPI /ws endpoint on port 8000 when the hook uses the Vite host.
        target: 'http://localhost:8000',
        ws: true,
      },
    },
  },
})
