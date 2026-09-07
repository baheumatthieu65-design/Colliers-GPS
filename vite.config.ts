import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isVercel = process.env.VERCEL === '1';
  const isCapacitor = mode === 'capacitor';
  const base = isVercel || isCapacitor ? './' : '/Colliers-GPS/';
  const publicBase = base === './' ? './' : '/Colliers-GPS/';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: publicBase,
          name: "Pâtur'GPS - Suivi Brebis & Clôtures",
          short_name: "Pâtur'GPS",
          description: "Application mobile de suivi GPS pastorale pour colliers de brebis avec carte interactive, géofencing et ordres Push.",
          theme_color: '#5A6F4E',
          background_color: '#F2F4F1',
          display: 'standalone',
          orientation: 'portrait',
          start_url: publicBase,
          scope: publicBase,
          icons: [
            { src: `${publicBase}pwa-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${publicBase}pwa-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${publicBase}pwa-maskable-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'] },
        devOptions: { enabled: true, type: 'module' },
      }),
    ],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    server: { hmr: process.env.DISABLE_HMR !== 'true', watch: process.env.DISABLE_HMR === 'true' ? null : {} },
  };
});
