// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ViteSitemap from 'vite-plugin-sitemap'; // Or your specific import name for the sitemap plugin

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  return {
    plugins: [
      react(),
      ViteSitemap({
        hostname: 'https://www.taskmaster.one', // Your production URL

        // Optional: Exclude specific routes if needed
        // exclude: ['/admin/**', '/private-page'],

        // Optional: Add dynamic routes (if any)
        // dynamicRoutes: ['/blog/post-1', '/blog/post-2'],

        // Optional: Change output file name (defaults are usually fine)
        // outDir: 'dist',
        // filename: 'sitemap.xml',

        // --- SOLUTION ---
        // Explicitly disable robots.txt generation by this plugin.
        // Vite will copy your public/robots.txt to the dist folder.
        generateRobotsTxt: false,
        // ----------------

        // Ensure other robots.txt related options are not active if 'generateRobotsTxt: false' is set
        // (Your current commented-out 'robots: [...]' is fine as it's not active)
        // robots: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
      }),
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      sourcemap: !isProduction, // Generate sourcemaps only for development, not for production
      rollupOptions: {
        output: {
          manualChunks: {
            // Group common vendor libraries
            vendor: [
              'react',
              'react-dom',
              'react-router-dom',
              'framer-motion',
              'react-helmet-async',
              // Add other larger, stable libraries here
            ],
            // Group Firebase SDKs
            firebase: [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              // Add other Firebase services you use
            ],
            // Example: Group UI components if they are significant
            // uiComponents: ['lucide-react', '@radix-ui/...'],
          },
        },
      },
    },
    // Optional: Server configuration if needed for local dev
    // server: {
    //   port: 3000,
    // },
  };
});
