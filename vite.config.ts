import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🚀 部署到GitHub Pages时，请修改为 '/仓库名/'
  // 例如：仓库名是 image-tool，则改为 base: '/image-tool/'
  // 本地开发时可以用 './' 或者直接用仓库名
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: []
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
})

