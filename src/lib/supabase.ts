import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase. Es null cuando faltan las variables de entorno
// (la página muestra entonces un aviso de configuración).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export type Supabase = NonNullable<typeof supabase>
