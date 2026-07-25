import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Mirrors the nginx /bot-api proxy so order tracking works in dev too.
    proxy: {
      '/bot-api': {
        target: process.env.BOT_DEV_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bot-api/, ''),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'app-icon-192.png', 'app-icon-512.png'],
      manifest: {
        id: '/',
        name: 'Errayhany Store',
        short_name: 'Errayhany',
        description: 'متجر بيع الإلكترونيات بالجملة',
        theme_color: '#142038',
        background_color: '#142038',
        // Open in a normal browser tab (desktop Electron app paused).
        display: 'browser',
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        categories: ['shopping', 'business'],
        icons: [
          {
            src: 'app-icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'app-icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: 'pwa-screenshots/wide-1.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'كتالوج Errayhany للجملة'
          },
          {
            src: 'pwa-screenshots/wide-2.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'تصفح المنتجات على سطح المكتب'
          },
          {
            src: 'pwa-screenshots/narrow-1.jpg',
            sizes: '1080x1920',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'كتالوج الجملة على الهاتف'
          },
          {
            src: 'pwa-screenshots/narrow-2.jpg',
            sizes: '1080x1920',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'سلة الطلبات'
          }
        ]
      }
    })
  ],
})
