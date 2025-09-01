import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Validate required environment variables
function validateEnv(env: Record<string, string>): void {
  const requiredVars = ['VITE_API_BASE_URL'];
  const missingVars = requiredVars.filter(varName => !env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Validate environment variables
  if (mode !== 'test') {
    validateEnv(env);
  }

  const isProduction = mode === 'production';
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:3000';
  const port = parseInt(env.PORT || '3001', 10);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'MCP Dashboard',
          short_name: 'MCP',
          description: 'Model Context Protocol Dashboard',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.example\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'api-cache',
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      }),
      nodePolyfills({
        protocolImports: true,
      }),
      isProduction && visualizer({
        open: true,
        filename: 'bundle-analyzer-report.html',
        gzipSize: true,
        brotliSize: true,
      }),
      isProduction && sentryVitePlugin({
        org: 'your-org-name',
        project: 'mcp-dashboard',
        authToken: env.SENTRY_AUTH_TOKEN,
      }),
    ].filter(Boolean),
    
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      open: !process.env.CI,
      fs: {
        strict: true,
      },
      proxy: {
        // Proxy API requests to the backend server
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: isProduction,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('Proxy error:', err);
            });
          },
        },
        // Proxy RPC requests to the backend server
        '/rpc': {
          target: apiTarget,
          changeOrigin: true,
          secure: isProduction,
          ws: true,
        }
      },
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port,
        overlay: true,
      },
    },
    
    preview: {
      port: 3002,
      strictPort: true,
    },

    build: {
      sourcemap: isProduction ? 'hidden' : true,
      outDir: 'dist',
      assetsDir: 'static',
      emptyOutDir: true,
      minify: isProduction ? 'esbuild' : false,
      cssMinify: isProduction,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            vendor: ['lodash', 'axios', 'date-fns'],
          },
        },
      },
    },

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    define: {
      'import.meta.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },

    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      esbuildOptions: {
        target: 'es2020',
      },
    },

  };
});
