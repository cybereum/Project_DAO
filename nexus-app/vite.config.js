import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Validate required env vars for production builds
  // eslint-disable-next-line no-undef
  const envAddress = typeof process !== 'undefined' ? process.env?.VITE_PROJECT_DAO_ADDRESS : undefined;
  if (mode === 'production' && envAddress) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(envAddress)) {
      throw new Error(`Invalid VITE_PROJECT_DAO_ADDRESS: "${envAddress}" — must be a valid Ethereum address (0x + 40 hex chars).`);
    }
  }

  return {
  plugins: [react(), tailwindcss()],
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
