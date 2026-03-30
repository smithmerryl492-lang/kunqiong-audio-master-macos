import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5177,
    host: true,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    rollupOptions: {
      output: {
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
    exclude: ['electron']
  },
  publicDir: 'public'
})
