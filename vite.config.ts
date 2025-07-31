import path from 'node:path'
import Vue from '@vitejs/plugin-vue'

import Unocss from 'unocss/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig, loadEnv } from 'vite'
// import { visualizer } from 'rollup-plugin-visualizer'
// import { compression } from 'vite-plugin-compression2'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'

  return {
    resolve: {
      alias: {
        '~/': `${path.resolve(__dirname, 'src')}/`,
        '@/': `${path.resolve(__dirname, 'src')}/`,
      },
    },

    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "~/styles/element/index.scss" as *;`,
          api: 'modern-compiler',
        },
      },
    },

    plugins: [
      Vue({
        script: {
          defineModel: true,
          propsDestructure: true
        }
      }),

      // https://github.com/posva/unplugin-vue-router
      VueRouter({
        extensions: ['.vue', '.md'],
        dts: 'src/typed-router.d.ts',
      }),

      Components({
        // allow auto load markdown components under `./src/components/`
        extensions: ['vue', 'md'],
        // allow auto import and register components used in markdown
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        resolvers: [
          ElementPlusResolver({
            importStyle: 'sass',
          }),
        ],
        dts: 'src/components.d.ts',
      }),

      // https://github.com/antfu/unocss
      // see uno.config.ts for config
      Unocss(),

      // 生产环境优化插件 - 暂时注释掉
      // ...(isProduction ? [
      //   // Gzip 压缩
      //   compression({
      //     algorithm: 'gzip',
      //     exclude: [/\.(br)$/, /\.(gz)$/]
      //   }),

      //   // Brotli 压缩
      //   compression({
      //     algorithm: 'brotliCompress',
      //     exclude: [/\.(br)$/, /\.(gz)$/]
      //   }),

      //   // 打包分析
      //   visualizer({
      //     filename: 'dist/stats.html',
      //     open: false,
      //     gzipSize: true,
      //     brotliSize: true
      //   })
      // ] : [])
    ],

    // 开发服务器配置
    server: {
      host: true,
      port: 3000,
      open: true,
      cors: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8059',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        }
      }
    },

    // 构建优化
    build: {
      target: 'es2015',
      cssTarget: 'chrome80',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
      rollupOptions: {
        output: {
          // 手动分包
          manualChunks: {
            // Vue 生态
            vue: ['vue', 'vue-router', 'pinia'],

            // Element Plus
            'element-plus': ['element-plus'],

            // 工具库
            utils: ['axios', 'dayjs'],

            // 业务组件
            components: [
              './src/components/common/VirtualList.vue',
              './src/components/common/VirtualMessageList.vue',
              './src/components/common/LazyImage.vue',
              './src/components/common/BaseModal.vue',
              './src/components/common/BaseButton.vue',
              './src/components/common/LoadingSpinner.vue'
            ]
          },

          // 文件命名
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
            if (facadeModuleId) {
              const fileName = path.basename(facadeModuleId, path.extname(facadeModuleId))
              return `js/${fileName}-[hash].js`
            }
            return 'js/[name]-[hash].js'
          },
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name!.split('.')
            const ext = info[info.length - 1]
            if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/.test(assetInfo.name!)) {
              return `media/[name]-[hash].${ext}`
            }
            if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(assetInfo.name!)) {
              return `images/[name]-[hash].${ext}`
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name!)) {
              return `fonts/[name]-[hash].${ext}`
            }
            return `assets/[name]-[hash].${ext}`
          }
        }
      },

      // 分包大小警告阈值
      chunkSizeWarningLimit: 1000,

      // 启用 CSS 代码分割
      cssCodeSplit: true,

      // 生成 source map
      sourcemap: !isProduction
    },

    // 优化配置
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'element-plus/es',
        'element-plus/es/components/button/style/css',
        'element-plus/es/components/input/style/css',
        'element-plus/es/components/message/style/css',
        'element-plus/es/components/message-box/style/css',
        'element-plus/es/components/dialog/style/css',
        'element-plus/es/components/avatar/style/css',
        'element-plus/es/components/icon/style/css',
        '@element-plus/icons-vue'
      ],
      exclude: ['@vueuse/core']
    },

    ssr: {
      // TODO: workaround until they support native ESM
      noExternal: ['element-plus'],
    },

    // 预览配置
    preview: {
      port: 4173,
      host: true,
      cors: true
    }
  }
})
