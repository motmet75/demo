import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
2  base: '/bom-inventory/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['anhmedia.vn', 'www.anhmedia.vn'],
    proxy: {
      '/sapi': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
