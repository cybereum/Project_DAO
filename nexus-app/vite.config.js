import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load VITE_* env vars from .env files (Vite doesn't expose them on process.env at config time)
  const env = loadEnv(mode, '.', 'VITE_');
  const envAddress = env.VITE_PROJECT_DAO_ADDRESS;

  if (mode === 'production') {
    if (!envAddress) {
      throw new Error('VITE_PROJECT_DAO_ADDRESS is required for production builds. Set it in .env or .env.production.');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(envAddress)) {
      throw new Error(`Invalid VITE_PROJECT_DAO_ADDRESS: "${envAddress}" — must be a valid Ethereum address (0x + 40 hex chars).`);
    }
  }

  return {
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
  build: {
    // Disable source maps for production
    sourcemap: false,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
    // Minification
    minify: 'esbuild',
  },
  };
})
