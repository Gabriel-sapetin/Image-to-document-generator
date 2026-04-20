import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      // proxy only the admin API calls, not the page itself
      '/admin/stats': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin/donations': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})