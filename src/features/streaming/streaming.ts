// Reglas y textos del negocio de streaming (sin React).
import { addDays, daysLeft, fmtDate, todayGT } from '@/lib/dates'
import { EXPIRY_WINDOW_DAYS } from '@/store/constants'
import type { Delivery, Item, Product, StockRow, StreamType } from '@/store/types'

export const STREAM_TYPE_LABEL: Record<StreamType, string> = { profile: 'Perfil', full: 'Cuenta completa' }
export const STREAM_TYPE_PLURAL: Record<StreamType, string> = { profile: 'perfiles', full: 'cuentas completas' }

/** Igual que en la base de datos: si el producto no tiene tipo, se deduce del nombre. */
export function streamTypeOf(p: Pick<Product, 'stream_type' | 'detail' | 'name'>): StreamType {
  if (p.stream_type) return p.stream_type
  return /complet/i.test(`${p.detail ?? ''} ${p.name ?? ''}`) ? 'full' : 'profile'
}

export const platformKey = (platform: string) => platform.trim().toLowerCase()
export const stockKey = (platform: string, type: StreamType) => `${platformKey(platform)}|${type}`

export function stockMap(rows: StockRow[]): Map<string, StockRow> {
  return new Map(rows.map(r => [stockKey(r.platform, r.stream_type), r]))
}

/** Existencias de un producto, o null si esa plataforma no se maneja con inventario. */
export function stockForProduct(stock: Map<string, StockRow>, p: Product): StockRow | null {
  if (p.category !== 'Streaming') return null
  const row = stock.get(stockKey(p.game_name || 'Otros', streamTypeOf(p)))
  return row && row.total > 0 ? row : null
}

export function stockBadge(row: StockRow | null): { text: string; color: string } | null {
  if (!row) return null
  if (row.available <= 0) return { text: 'Agotado', color: '#f06675' }
  if (row.available <= 5) return { text: `Quedan ${row.available}`, color: '#ffcc00' }
  return { text: 'Disponible · entrega inmediata', color: '#25d366' }
}

export function baseDel(it: Item): Delivery {
  return {
    email: it.delivery_email ?? '',
    password: it.delivery_password ?? '',
    profile: it.delivery_profile ?? '',
    pin: it.delivery_pin ?? '',
    valid_until: it.valid_until ?? addDays(todayGT(), it.duration_days ?? 30),
  }
}

export function itemDelivery(it: Item): Delivery {
  return { email: it.delivery_email ?? '', password: it.delivery_password ?? '', profile: it.delivery_profile ?? '', pin: it.delivery_pin ?? '', valid_until: it.valid_until ?? '' }
}

/** Mensaje con los datos de la cuenta, listo para pegar en WhatsApp. */
export function deliveryText(game: string, d: Delivery): string {
  return `*${game} - ${d.profile}*\n\n📩 Correo: ${d.email}\n🔑 Contraseña: ${d.password}\n👥 Perfil: ${d.profile}\n🚨 Pin: ${d.pin || '—'}\n\nVálido hasta ${fmtDate(d.valid_until)}`
}

/** Recordatorio de vencimiento que el distribuidor envía a su cliente. */
export function reminderText(it: Item): string {
  const name = it.end_customer_name?.trim()
  const left = it.valid_until ? daysLeft(it.valid_until) : 0
  const when = left > 1 ? `vence en ${left} días (${fmtDate(it.valid_until)})` : left === 1 ? `vence mañana (${fmtDate(it.valid_until)})` : left === 0 ? 'vence hoy' : `venció el ${fmtDate(it.valid_until)}`
  return `Hola${name ? ` ${name}` : ''} 👋\n\nTe recuerdo que tu *${it.game_name} - ${it.delivery_profile || ''}* ${when}.\n\n¿Deseas renovarlo? Avísame para mantener tu servicio activo sin interrupciones. 🙌`
}

export type SubState = 'active' | 'expiring' | 'expired' | 'revoked'

export function subState(it: Item): SubState {
  if (it.access_revoked_at) return 'revoked'
  const left = daysLeft(it.valid_until ?? todayGT())
  if (left < 0) return 'expired'
  if (left <= EXPIRY_WINDOW_DAYS) return 'expiring'
  return 'active'
}

export const SUB_STATE_LABEL: Record<SubState, { text: string; color: string }> = {
  active: { text: 'Activa', color: '#25d366' },
  expiring: { text: 'Por vencer', color: '#ffcc00' },
  expired: { text: 'Vencida', color: '#f06675' },
  revoked: { text: 'Finalizada', color: '#8b98a8' },
}

/** Línea de streaming entregada (no renovación) con fecha de vencimiento. */
export const isDeliveredSub = (it: Item) => it.category === 'Streaming' && !it.renewal_of && !!it.valid_until
