import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🚀 部署配置
  // GitHub Pages: base: '/image3/'
  // Cloudflare Pages / Vercel / Netlify: base: '/'
  base: './',  // GitHub Pages 配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 提高 chunk 大小警告阈值（因为 AI 模块确实很大）
    chunkSizeWarningLimit: 1000,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 使用 esbuild 压缩（比 terser 更快）
    minify: 'esbuild',
    // 移除 console 和 debugger（esbuild 不支持，但生产环境影响不大）
    rollupOptions: {
      output: {
        // 优化文件名以支持更好的缓存
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // React 核心库
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          
          // TensorFlow.js 和 AI 相关（最大的依赖）
          if (id.includes('@tensorflow') || id.includes('upscaler') || id.includes('@upscalerjs')) {
            return 'vendor-ai'
          }
          
          // 图片处理工具
          if (id.includes('potrace') || id.includes('jszip') || id.includes('file-saver')) {
            return 'vendor-utils'
          }
          
          // 其他第三方库
          if (id.includes('node_modules')) {
            return 'vendor-other'
          }
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

