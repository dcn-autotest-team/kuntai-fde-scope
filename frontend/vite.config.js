import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    clearMocks: true,
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{js,vue}'],
      exclude: ['src/**/__tests__/**'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  }
})
