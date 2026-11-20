import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Separate static customer build. HTML/JS assets live under
 * /bom-inventory/customer-assets; customer page URLs stay /bom-inventory/shop/*.
 * Production Nginx serves the customer.html file for those shop paths.
 * API routing continues to use /sapi and the existing Redis-backed order buffer.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['zbar-inlined', 'module', 'browser', 'development|production'],
  },
  base: '/bom-inventory/customer-assets/',
  build: {
    outDir: 'dist-customer',
    emptyOutDir: true,
    rollupOptions: {
      input: 'customer.html',
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@undecaf/zbar-wasm')) return 'zbar-qr'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
