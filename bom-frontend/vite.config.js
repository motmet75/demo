import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/bom-inventory',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/sapi': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})