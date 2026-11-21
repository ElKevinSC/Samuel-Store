import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

// En Netlify se usa su complemento (igual que siempre).
// En cualquier otra plataforma (Vercel, Cloudflare, etc.) se genera una
// página estática (modo SPA): la tienda no usa código de servidor, todo
// habla directo con Supabase desde el navegador.
const onNetlify = !!process.env.NETLIFY

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    ...(onNetlify ? [netlify()] : []),
    tanstackStart(onNetlify ? undefined : { spa: { enabled: true } }),
    viteReact(),
  ],
})

export default config
