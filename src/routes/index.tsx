import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/home/HomePage'
import { supabase } from '@/lib/supabase'
import { StoreProvider } from '@/store/StoreProvider'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  if (!supabase) {
    return (
      <div className="storefront wrap" style={{ padding: 32 }}>
        <h1>Samuel Store</h1>
        <p>Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno de Netlify y vuelve a publicar.</p>
      </div>
    )
  }
  return (
    <StoreProvider supabase={supabase}>
      <HomePage />
    </StoreProvider>
  )
}
