import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/HPA_CABS/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HPA Cabs - Track Profits & Expenses',
        short_name: 'HPA Cabs',
        description: 'Manage your cab business income and expenses',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/HPA_CABS/',
        start_url: '/HPA_CABS/',
        icons: [
          {
            src: '/HPA_CABS/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/HPA_CABS/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
