import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';
import { resolve } from 'path';
import { loadEnv } from 'vite';
import { IS_EXTERNAL_TEMPLATING, SSR_ENABLED } from './config';
import { generateAssetsFilesPlugin } from './plugins/vite/generate-assets-files';

const { HOST, PORT = 3000, PUBLIC_STATIC_BASE = '' } = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

// Baked into every bundle including the worker — see src/shared/lib/static-url.ts.
// Custom constant instead of import.meta.env: Astro's env plugin replaces those
// before user define runs and swallows unknown vars.
const staticBaseDefine = {
    __STATIC_BASE__: JSON.stringify(PUBLIC_STATIC_BASE),
};

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
              define: staticBaseDefine,
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
              define: staticBaseDefine,
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
