import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const sapiProxy = {
  target: 'http://127.0.0.1:8081',
  changeOrigin: true
}

export default defineConfig({
  plugins: [react()],
  base: '/bom-inventory/',
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
    allowedHosts: ['anhmedia.vn', 'www.anhmedia.vn', 'localhost', '127.0.0.1'],
    proxy: {
      '/sapi': sapiProxy
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/sapi': sapiProxy
    }
  }
})
