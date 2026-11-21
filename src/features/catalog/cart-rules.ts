// Reglas para agregar productos al carrito.
import { STREAM_TYPE_PLURAL, stockForProduct, stockKey, streamTypeOf } from '@/features/streaming/streaming'
import type { CartLine, Product, StockRow } from '@/store/types'

/** Combinaciones que no se permiten en un mismo pedido (mismas reglas de siempre). */
export function cartConflict(cart: CartLine[], p: Product): string | null {
  if (cart.length === 0) return null
  const first = cart[0].product
  if (first.category !== p.category) return 'No puedes mezclar videojuegos y streaming en el mismo pedido.'
  if (first.contact_type !== p.contact_type) return 'Estos paquetes piden datos distintos. Haz pedidos separados.'
  if (p.category === 'Videojuegos' && first.game_name !== p.game_name) return 'Solo puedes agregar paquetes del mismo juego al carrito.'
  return null
}

/**
 * Solo streaming con inventario: evita pedir más cuentas de las que hay.
 * `adding` es cuántas unidades más se quieren sumar.
 */
export function stockProblem(cart: CartLine[], p: Product, stock: Map<string, StockRow>, adding = 1): string | null {
  const row = stockForProduct(stock, p)
  if (!row) return null
  const type = streamTypeOf(p)
  const key = stockKey(p.game_name || 'Otros', type)
  const inCart = cart
    .filter(l => l.product.category === 'Streaming' && stockKey(l.product.game_name || 'Otros', streamTypeOf(l.product)) === key)
    .reduce((t, l) => t + l.quantity, 0)
  if (inCart + adding <= row.available) return null
  const what = `${STREAM_TYPE_PLURAL[type]} de ${p.game_name || 'esta plataforma'}`
  return row.available <= 0 ? `Por ahora no hay ${what} disponibles.` : `Solo quedan ${row.available} ${what} disponibles.`
}
