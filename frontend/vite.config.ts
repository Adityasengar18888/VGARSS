import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Determine base path: defaults to '/vgarss/' for production deployment on adityasengar.online/vgarss, overridable via VITE_BASE_PATH
const basePath = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/vgarss/' : '/');

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
        navigateFallback: `${basePath.endsWith('/') ? basePath : basePath + '/'}index.html`,
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
