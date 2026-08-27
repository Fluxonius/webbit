import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Node torrent engine listens on 8080; Vite dev server proxies API,
// WebSocket, streaming and download traffic to it so the browser only ever
// talks to one origin.
const SERVER = 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: SERVER, changeOrigin: true },
      '/stream': { target: SERVER, changeOrigin: true },
      '/download': { target: SERVER, changeOrigin: true },
      '/ws': { target: SERVER, ws: true, changeOrigin: true },
    },
  },
})
