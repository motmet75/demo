import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/bom/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/api/viettelpost': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/api/orders': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})