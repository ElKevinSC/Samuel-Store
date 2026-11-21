// Lecturas de Supabase. No guardan estado: devuelven datos y errores.
import type { Supabase } from '@/lib/supabase'
import { signedReceiptUrl } from '@/lib/receipts'
import { INVENTORY_FIELDS, ITEM_FIELDS, LEGACY_ITEM_FIELDS, LEGACY_PRODUCT_FIELDS, PRODUCT_FIELDS } from './constants'
import type { Bank, InventoryAccount, Order, Product, Profile, StockRow } from './types'

type DbError = { code?: string; message: string } | null
type DbResult = { data: unknown; error: DbError }

/** Error de columna inexistente: la migración de inventario aún no se ejecutó. */
function isMissingColumn(e: DbError): boolean {
  return !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist/i.test(e.message))
}

async function withFallback(run: (fields: string) => PromiseLike<DbResult>, fields: string, legacy: string): Promise<DbResult> {
  const first = await run(fields)
  return isMissingColumn(first.error) ? run(legacy) : first
}

const ordersSelect = (items: string) => `*, products(detail,game_name), order_items(${items})`

export async function fetchActiveProducts(sb: Supabase) {
  const r = await withFallback(
    f => sb.from('products').select(f).eq('active', true).order('created_at', { ascending: false }),
    PRODUCT_FIELDS, LEGACY_PRODUCT_FIELDS,
  )
  return { data: (r.data ?? null) as Product[] | null, error: r.error }
}

export async function fetchActiveBanks(sb: Supabase) {
  const { data, error } = await sb.from('bank_accounts').select('id,bank_name,account_number,account_holder,active').eq('active', true)
  return { data: (data ?? []) as Bank[], error }
}

export async function fetchOrdersOf(sb: Supabase, uid: string) {
  const r = await withFallback(
    f => sb.from('orders').select(ordersSelect(f)).eq('user_id', uid).order('created_at', { ascending: false }),
    ITEM_FIELDS, LEGACY_ITEM_FIELDS,
  )
  return { data: (r.data ?? null) as Order[] | null, error: r.error }
}

export async function fetchUserRole(sb: Supabase, uid: string) {
  return sb.from('profiles').select('role,application_status').eq('id', uid).maybeSingle()
}

/** Existencias públicas. Si la función no existe todavía, devuelve lista vacía. */
export async function fetchStock(sb: Supabase): Promise<StockRow[]> {
  const { data, error } = await sb.rpc('streaming_stock')
  if (error) return []
  return ((data ?? []) as StockRow[]).map(r => ({ ...r, available: Number(r.available), total: Number(r.total) }))
}

/** Todo lo que necesita el panel de administración. */
export async function fetchAdminData(sb: Supabase) {
  const [p, b, o, ap, inv] = await Promise.all([
    sb.from('profiles').select('id,full_name,role,application_status,age,expected_sales,whatsapp'),
    sb.from('bank_accounts').select('id,bank_name,account_number,account_holder,active').eq('active', true),
    withFallback(
      f => sb.from('orders').select(`${ordersSelect(f)}, profiles(full_name)`).order('created_at', { ascending: false }),
      ITEM_FIELDS, LEGACY_ITEM_FIELDS,
    ),
    withFallback(
      f => sb.from('products').select(f).order('game_name', { ascending: true }).order('created_at', { ascending: true }),
      PRODUCT_FIELDS, LEGACY_PRODUCT_FIELDS,
    ),
    sb.from('streaming_accounts').select(INVENTORY_FIELDS).order('platform', { ascending: true }).order('created_at', { ascending: true }),
  ])

  let orders: Order[] | null = null
  if (o.data) {
    orders = await Promise.all((o.data as Order[]).map(async item => {
      if (!item.receipt_path) return item
      return { ...item, receipt_signed_url: await signedReceiptUrl(sb, item.receipt_path) }
    }))
  }
  if (inv.error) console.warn('Inventario no disponible (¿falta ejecutar la migración?):', inv.error.message)

  return {
    profiles: (p.data ?? null) as Profile[] | null,
    banks: (b.data ?? null) as Bank[] | null,
    orders,
    allProducts: (ap.data ?? null) as Product[] | null,
    inventory: inv.error ? null : ((inv.data ?? []) as InventoryAccount[]),
    errors: { profiles: p.error, banks: b.error, orders: o.error },
  }
}
