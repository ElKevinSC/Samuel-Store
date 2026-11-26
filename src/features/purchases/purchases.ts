// Suscripciones de streaming a partir de los pedidos (los del usuario, o
// todos si es el administrador): filtros, plataformas y tiempo restante. Sin React.
import { isDeliveredSub, platformKey, subState, type SubState } from '@/features/streaming/streaming'
import { daysLeft, gtDate } from '@/lib/dates'
import { OPEN_ORDER_STATUSES } from '@/store/constants'
import type { Item, Order } from '@/store/types'

/** Días hacia atrás que cuentan como compra "reciente". */
export const RECENT_DAYS = 7

export type Purchase = { item: Item; order: Order }

/** Fecha de compra (AAAA-MM-DD, hora de Guatemala): cuando se aprobó o, si no, cuando se pidió. */
export const purchaseDate = (o: Order) => gtDate(o.completed_at || o.created_at)

export const isRecent = (p: Purchase) => -daysLeft(purchaseDate(p.order)) <= RECENT_DAYS

/** Suscripciones de streaming entregadas, la más nueva primero. */
export function streamingPurchases(orders: Order[]): Purchase[] {
  const list: Purchase[] = []
  for (const o of orders) {
    if (o.status !== 'completed') continue
    for (const it of o.order_items ?? []) if (isDeliveredSub(it)) list.push({ item: it, order: o })
  }
  return list.sort((a, b) => purchaseDate(b.order).localeCompare(purchaseDate(a.order)) || String(a.item.valid_until).localeCompare(String(b.item.valid_until)))
}

/** Pedidos de streaming que todavía esperan aprobación. */
export const pendingStreamingOrders = (orders: Order[]) =>
  orders.filter(o => OPEN_ORDER_STATUSES.includes(o.status) && (o.order_items ?? []).some(it => it.category === 'Streaming'))

// ---------------- Filtros ----------------
export type StreamFilter = 'recent' | 'all' | SubState

export function matchStream(p: Purchase, f: StreamFilter): boolean {
  if (f === 'all') return true
  if (f === 'recent') return isRecent(p)
  return subState(p.item) === f
}

/** Búsqueda libre: plataforma, perfil, correo, PIN, cliente final y (admin) comprador. */
export function matchSearch(p: Purchase, term: string, includeBuyer: boolean): boolean {
  const t = term.trim().toLowerCase()
  if (!t) return true
  const { item: it, order: o } = p
  const fields = [it.game_name, it.product_name, it.delivery_profile, it.delivery_email, it.delivery_pin,
    it.end_customer_name, it.end_customer_phone, it.player_id, o.player_id, o.reference_nc]
  if (includeBuyer) fields.push(o.profiles?.full_name)
  return fields.some(v => (v ?? '').toLowerCase().includes(t))
}

// ---------------- Plataformas ----------------
export type PlatformGroup = { key: string; name: string; count: number; full: number }

export function groupByPlatform(list: Purchase[]): PlatformGroup[] {
  const m = new Map<string, PlatformGroup>()
  for (const { item } of list) {
    const key = platformKey(item.game_name || 'Otra')
    const g = m.get(key) ?? { key, name: (item.game_name || 'Otra').trim(), count: 0, full: 0 }
    g.count += 1
    if (/complet/i.test(item.delivery_profile ?? '')) g.full += 1
    m.set(key, g)
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
}

/** "3 perfiles", "1 cuenta completa", "2 perfiles · 1 completa". */
export function platformCountText(g: PlatformGroup): string {
  const profiles = g.count - g.full
  if (g.full === 0) return `${profiles} perfil${profiles === 1 ? '' : 'es'}`
  if (profiles === 0) return `${g.full} cuenta${g.full === 1 ? '' : 's'} completa${g.full === 1 ? '' : 's'}`
  return `${profiles} perfil${profiles === 1 ? '' : 'es'} · ${g.full} completa${g.full === 1 ? '' : 's'}`
}

// ---------------- Tiempo restante ----------------
/** Porcentaje de tiempo que le queda (0–100) según la duración del producto. */
export function remainingPct(it: Item): number {
  if (it.access_revoked_at || !it.valid_until) return 0
  const left = daysLeft(it.valid_until)
  const total = Math.max(1, it.duration_days || 30)
  return Math.max(0, Math.min(100, Math.round((left / total) * 100)))
}

export function remainingText(it: Item): string {
  if (!it.valid_until) return ''
  const left = daysLeft(it.valid_until)
  if (left > 1) return `Vence en ${left} días`
  if (left === 1) return 'Vence mañana'
  if (left === 0) return 'Vence hoy'
  return `Venció hace ${-left} día${left === -1 ? '' : 's'}`
}

