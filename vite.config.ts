import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'Khazanah Digital',
          short_name: 'Khazanah',
          description: 'Khazanah Digital adalah platform untuk menulis, membaca, menerbitkan, dan membagikan kitab, buku, manuskrip, artikel, serta karya ilmiah dengan struktur hierarki tanpa batas.',
          theme_color: '#FDFBF7',
          background_color: '#FDFBF7',
          display: 'standalone',
          icons: [
            {
              src: '/favicon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/favicon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/favicon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: [
        'kitabdigital.zoeldev.my.id',
        'kitab.zoeldev.my.id',
        'khazanah.zoeldev.my.id',
        'localhost',
        '127.0.0.1',
        '.run.app',
        '.googleusercontent.com'
      ],
    },
  };
});
