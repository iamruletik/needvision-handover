import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';
import { resolve } from 'path';
import { loadEnv } from 'vite';
import { IS_EXTERNAL_TEMPLATING, SSR_ENABLED } from './config';
import { generateAssetsFilesPlugin } from './plugins/vite/generate-assets-files';

const { HOST, PORT = 3000 } = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
    ...(SSR_ENABLED
        ? {
              output: 'server',
              adapter: node({ mode: 'standalone' }),
          }
        : {}),

    compressHTML: !IS_EXTERNAL_TEMPLATING,

    server: {
        port: Number(PORT),
    },

    build: {
        assets: 'assets',
    },

    vite: IS_EXTERNAL_TEMPLATING
        ? {
              build: {
                  assetsInlineLimit: 0,
                  cssCodeSplit: false,
                  manifest: true,
                  rollupOptions: {
                      input: {
                          app: 'src/app/app.ts',
                      },
                      output: {
                          entryFileNames: (chunkInfo) => {
                              if (chunkInfo.name.includes('app') || chunkInfo.name.includes('RootLayout')) {
                                  return 'assets/app.js';
                              }
                              return 'assets/[name].js';
                          },
                          chunkFileNames: `assets/[name].js`,
                          assetFileNames: (assetInfo) => {
                              if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
                                  return 'assets/app.css';
                              }
                              return 'assets/[name].[ext]';
                          },
                      },
                  },
              },
              worker: {
                  rollupOptions: {
                      output: {
                          entryFileNames: `assets/[name].js`,
                      },
                  },
              },
              plugins: [
                  generateAssetsFilesPlugin({
                      css: {
                          src: 'src/app/app.ts',
                          dest: 'build/php_includes/css.php',
                      },
                      js: {
                          src: 'src/app/app.ts',
                          dest: 'build/php_includes/js.php',
                      },
                  }) as any,
              ],
              resolve: {
                  alias: {
                      '@': resolve(process.cwd(), 'src'),
                  },
              },
          }
        : {
              resolve: {
                  alias: {
                      '@': resolve(process.cwd(), 'src'),
                  },
              },
          },

    site: HOST,
    outDir: 'build',
    trailingSlash: 'always',

    env: {
        schema: {
            HOST: envField.string({ context: 'client', access: 'public' }),
        },
    },
});
