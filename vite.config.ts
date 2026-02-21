import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/meshy-api': {
        target: 'https://api.meshy.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/meshy-api/, ''),
      },
      '/meshy-assets': {
        target: 'https://assets.meshy.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/meshy-assets/, ''),
      },
    },
  },
})
