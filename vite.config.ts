import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ViteSitemap from 'vite-plugin-sitemap';

export default defineConfig(({ command }) => { // Access command to check if it's 'build'
  const isProduction = command === 'build';

  return {
    plugins: [
      react(),
      ViteSitemap({ // Sitemap configuration
        hostname: 'https://www.taskmaster.one', // Your production URL
        // Optional: Exclude specific routes
        // exclude: ['/admin/**', '/private-page'],
        // Optional: Add dynamic routes (if any, though your app seems SPA focused)
        // dynamicRoutes: ['/blog/post-1', '/blog/post-2'],
        // Optional: Change output file name
        // outDir: 'dist', // Default is 'dist'
        // filename: 'sitemap.xml', // Default is 'sitemap.xml'
        // Optional: Customize sitemap entries
        // generateRobotsTxt: true, // Can also generate a basic robots.txt here
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
