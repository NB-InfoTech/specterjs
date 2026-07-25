import { defineConfig } from 'vite'

// GitHub Pages project site path for https://<user>.github.io/specterjs/
const REPO_NAME = 'specterjs'

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
