import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'crypto'],
      globals: { Buffer: true, process: true, global: true },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/opnet-rpc': {
        target: 'https://mainnet.opnet.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opnet-rpc/, '/api/v1/json-rpc'),
        secure: true,
      },
    },
  }
})
