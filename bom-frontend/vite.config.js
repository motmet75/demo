import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const mainApiProxy = {
  target: 'http://127.0.0.1:8081',
  changeOrigin: true
}

const orderBufferProxy = {
  target: 'http://127.0.0.1:8082',
  changeOrigin: true
}

const apiProxyRules = {
  '/sapi/order-buffer': orderBufferProxy,
  '^/sapi/shop/public/orders(?:\\?.*)?$': orderBufferProxy,
  '^/sapi/shop/public/(?:token/[^/?]+|menu|menu-options|shop-config|tables|ordering-status|localized-labels)(?:\\?.*)?$': orderBufferProxy,
  '^/sapi/shop/staff/order-drafts(?:/[^?]*)?(?:\\?.*)?$': orderBufferProxy,
  '/sapi': mainApiProxy
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
    proxy: apiProxyRules
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: apiProxyRules
  }
})
