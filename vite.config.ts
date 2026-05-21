import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseTarget = (
    env.VITE_SUPABASE_URL || 'https://kfazbwaxvbhpqnzuxsft.supabase.co'
  )
    .trim()
    .replace(/\/+$/, '')
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  return {
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    proxy: {
      '/api/invite-representative': {
        target: supabaseTarget,
        changeOrigin: true,
        secure: true,
        rewrite: () =>
          '/functions/v1/invite-representative?forceFunctionRegion=sa-east-1',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (supabaseAnonKey) {
              proxyReq.setHeader('apikey', supabaseAnonKey)
            }
            const auth = req.headers.authorization
            if (auth) {
              proxyReq.setHeader('Authorization', auth)
            }
          })
        },
      },
    },
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  }
})
