// Lógica del inventario de cuentas (sin React): lectura de listas pegadas,
// resumen de existencias y cuántas cuentas necesita cada pedido.
import { STREAM_TYPE_LABEL, platformKey, stockKey, streamTypeOf } from '@/features/streaming/streaming'
import type { InventoryAccount, Item, Product, StockRow, StreamType } from '@/store/types'

export type NewAccount = { email: string; password: string; profile_name: string | null; pin: string | null }

const SEPARATOR = /\s*[|\t]\s*/
const clean = (v: string | undefined) => (v ?? '').trim()

function checkCredentials(email: string, password: string, n: number, errors: string[]): boolean {
  if (!email || !password) { errors.push(`Línea ${n}: falta el correo o la contraseña.`); return false }
  if (/\s/.test(email) || email.length > 200) { errors.push(`Línea ${n}: el correo "${email}" no es válido.`); return false }
  if (password.length > 200) { errors.push(`Línea ${n}: la contraseña es demasiado larga.`); return false }
  return true
}

/**
 * Lista pegada, una cuenta por línea, separada por | o tabulador:
 *   perfiles:        correo | contraseña | perfil | pin
 *   cuenta completa: correo | contraseña
 */
export function parseAccountList(text: string, type: StreamType): { rows: NewAccount[]; errors: string[] } {
  const rows: NewAccount[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const [email, password, profile, pin] = line.split(SEPARATOR).map(clean)
    if (!checkCredentials(email, password, i + 1, errors)) return
    if (type === 'profile' && !profile) { errors.push(`Línea ${i + 1}: falta el nombre del perfil (Ej. P1).`); return }
    rows.push({ email, password, profile_name: type === 'profile' ? profile : null, pin: pin || null })
  })
  return { rows, errors }
}

/** Una cuenta con varios perfiles: un perfil por línea, "perfil | pin". */
export function parseProfilesOfAccount(email: string, password: string, text: string): { rows: NewAccount[]; errors: string[] } {
  const rows: NewAccount[] = []
  const errors: string[] = []
  if (!checkCredentials(email.trim(), password.trim(), 0, errors)) return { rows, errors: ['Escribe un correo y una contraseña válidos.'] }
  text.split(/\r?\n/).forEach(raw => {
    const line = raw.trim()
    if (!line) return
    const [profile, pin] = line.split(SEPARATOR).map(clean)
    rows.push({ email: email.trim(), password: password.trim(), profile_name: profile, pin: pin || null })
  })
  if (rows.length === 0) errors.push('Escribe al menos un perfil.')
  return { rows, errors }
}

/** Clave única de un "lugar" del inventario (igual que el índice de la base de datos). */
export const slotKey = (platform: string, email: string, profile: string | null) =>
  `${platformKey(platform)}|${email.trim().toLowerCase()}|${(profile ?? '').trim().toLowerCase()}`

/** Quita duplicados del lote y los que ya existen en el inventario. */
export function splitDuplicates(platform: string, rows: NewAccount[], inventory: InventoryAccount[]) {
  const existing = new Set(inventory.map(a => slotKey(a.platform, a.email, a.profile_name)))
  const seen = new Set<string>()
  const fresh: NewAccount[] = []
  let duplicates = 0
  for (const r of rows) {
    const k = slotKey(platform, r.email, r.profile_name)
    if (existing.has(k) || seen.has(k)) { duplicates += 1; continue }
    seen.add(k)
    fresh.push(r)
  }
  return { fresh, duplicates }
}

export type InventorySummary = { key: string; platform: string; type: StreamType; available: number; assigned: number; disabled: number }

export function summarizeInventory(inventory: InventoryAccount[]): InventorySummary[] {
  const m = new Map<string, InventorySummary>()
  for (const a of inventory) {
    const key = stockKey(a.platform, a.stream_type)
    const s = m.get(key) ?? { key, platform: a.platform.trim(), type: a.stream_type, available: 0, assigned: 0, disabled: 0 }
    s[a.status === 'available' ? 'available' : a.status === 'assigned' ? 'assigned' : 'disabled'] += 1
    m.set(key, s)
  }
  return Array.from(m.values()).sort((a, b) => a.platform.localeCompare(b.platform) || a.type.localeCompare(b.type))
}

/** Tipo de entrega de una línea de pedido, según su producto. */
export function itemStreamType(it: Item, productsById: Map<string, Product>): StreamType {
  const p = it.product_id ? productsById.get(it.product_id) : undefined
  return p ? streamTypeOf(p) : streamTypeOf({ stream_type: null, detail: it.product_name, name: it.product_name })
}

export type Need = { key: string; label: string; needed: number; available: number; tracked: boolean }

/** Cuántas cuentas pide el pedido por plataforma y tipo, y cuántas hay. */
export function inventoryNeeds(items: Item[], productsById: Map<string, Product>, stock: Map<string, StockRow>): Need[] {
  const m = new Map<string, Need>()
  for (const it of items) {
    const type = itemStreamType(it, productsById)
    const key = stockKey(it.game_name, type)
    const row = stock.get(key)
    const n = m.get(key) ?? { key, label: `${it.game_name} · ${STREAM_TYPE_LABEL[type]}`, needed: 0, available: row?.available ?? 0, tracked: (row?.total ?? 0) > 0 }
    n.needed += Math.max(1, Number(it.quantity) || 1)
    m.set(key, n)
  }
  return Array.from(m.values())
}
