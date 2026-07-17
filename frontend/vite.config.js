import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // "/api/..." requests from the React app are forwarded to Spring Boot.
    // The browser only ever talks to :5173 - no CORS drama during development.
    proxy: {
      '/api': 'http://localhost:8080',
    },
    // listen on the network too, so sellers' phones can open the dev app over Wi-Fi
    host: true,
  },
})
