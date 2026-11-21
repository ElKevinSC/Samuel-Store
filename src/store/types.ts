import type { Category } from '@/data/catalog'

/** Cómo se entrega un producto de streaming. */
export type StreamType = 'profile' | 'full'

export type Product = {
  id: string
  name: string
  detail: string
  game_name: string | null
  category: Category
  price: number
  reseller_price: number
  active: boolean
  contact_type: string
  duration_days: number | null
  image_url?: string | null
  stream_type?: StreamType | null
}

/** Una línea de pedido. En streaming también es la "suscripción" entregada. */
export type Item = {
  id: string
  game_name: string
  product_name: string
  product_id: string | null
  player_id: string
  quantity: number
  unit_price: number
  line_total: number
  category: string
  contact_type: string
  duration_days: number | null
  renewal_of: string | null
  delivery_email: string | null
  delivery_password: string | null
  delivery_profile: string | null
  delivery_pin: string | null
  valid_until: string | null
  delivered_at: string | null
  inventory_account_id?: string | null
  access_revoked_at?: string | null
  end_customer_name?: string | null
  end_customer_phone?: string | null
}

export type Order = {
  id: string
  user_id: string
  product_id: string | null
  player_id: string
  amount: number
  reference_nc: string
  deposit_date: string | null
  receipt_path: string | null
  status: string
  created_at: string
  completed_at?: string | null
  products?: { detail?: string; game_name?: string } | null
  order_items?: Item[] | null
  profiles?: { full_name?: string } | null
  receipt_signed_url?: string | null
}

export type Bank = { id: string; bank_name: string; account_number: string; account_holder: string; active: boolean }

export type Profile = {
  id: string
  full_name: string
  role: string
  application_status: string
  age?: number | null
  expected_sales?: number | null
  whatsapp?: string | null
}

/** Datos de acceso que se entregan al cliente. */
export type Delivery = { email: string; password: string; profile: string; pin: string; valid_until: string }

export type CartLine = { product: Product; quantity: number }

/** Una cuenta (o un perfil de una cuenta) del inventario. */
export type InventoryAccount = {
  id: string
  platform: string
  stream_type: StreamType
  email: string
  password: string
  profile_name: string | null
  pin: string | null
  status: 'available' | 'assigned' | 'disabled'
  assigned_item_id: string | null
  assigned_at: string | null
  notes: string | null
  created_at: string
}

/** Existencias por plataforma y tipo (sin datos de acceso). */
export type StockRow = { platform: string; stream_type: StreamType; available: number; total: number }

/** Suscripción entregada junto con el pedido al que pertenece (vista de admin). */
export type Subscription = { item: Item; order: Order }

export type ModalName =
  | 'login' | 'register' | 'forgot' | 'new_password'
  | 'reseller_apply'
  | 'checkout' | 'order_done' | 'my_orders' | 'user_orders'
  | 'my_subs' | 'renew'
  | 'terms' | 'legal' | 'privacy'

export type AdminTab =
  | 'inicio' | 'videojuegos' | 'streaming' | 'inventario' | 'pagos' | 'ventas'
  | 'revendedores' | 'productos' | 'bancos' | 'clientes'
