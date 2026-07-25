import { defineConfig } from 'vite'

// GitHub Pages repository name - change this to your repo name
const REPO_NAME = 'phantom-audit'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: `/${REPO_NAME}/`,
  build: {
    outDir: 'docs',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2022',
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@modules': '/src/modules',
      '@ui': '/src/ui'
    }
  }
})