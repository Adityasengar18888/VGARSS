import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Use relative base './' so assets load seamlessly at root (https://vgarss.vercel.app)
// AND under subpaths (https://adityasengar.online/vgarss) without 404s or MIME type mismatches
const basePath = process.env.VITE_BASE_PATH || './';

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'offline.html', 'icons/*.png', 'icons/*.svg'],
      manifest: false, // Authoritative manifest placed in public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: null, // Let SPA router and Vercel handle client-side navigations
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/ws/,
          /^\/docs/,
          /^\/redoc/,
          /^\/openapi\.json/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vgarss-navigations',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
