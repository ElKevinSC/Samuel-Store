import { ShoppingCart } from 'lucide-react'
import { money } from '@/data/catalog'
import { stockBadge, stockForProduct } from '@/features/streaming/streaming'
import { useStore } from '@/store/StoreProvider'
import type { Product } from '@/store/types'
import { cartConflict, stockProblem } from './cart-rules'

/** Paquetes del juego o plataforma seleccionada. */
export function ProductGrid({ items }: { items: Product[] }) {
  const { user, cart, unitPrice, addToCart, showToast, setModal, stockByKey } = useStore()

  function tryAdd(p: Product) {
    if (!user) {
      setModal('login')
      return
    }
    const problem = cartConflict(cart, p) ?? stockProblem(cart, p, stockByKey)
    if (problem) {
      showToast(problem)
      return
    }
    addToCart(p)
  }

  return (
    <div className="product-grid">
      {items.length === 0 ? (
        <p>No hay paquetes para este juego.</p>
      ) : (
        items.map(p => {
          const badge = stockBadge(stockForProduct(stockByKey, p))
          const soldOut = badge?.text === 'Agotado'
          return (
            <article className="product-card" key={p.id}>
              <div className="product-info">
                <h3>{p.detail || p.name}</h3>
                {badge && <p style={{ fontSize: 12, color: badge.color, margin: '2px 0 6px' }}>{badge.text}</p>}
                <div className="price-row">
                  <div>
                    <span className="price-caption">Precio</span>
                    <strong>{money(unitPrice(p))}</strong>
                  </div>
                  <button className="button small" disabled={soldOut} style={soldOut ? { opacity: 0.45 } : undefined} onClick={() => tryAdd(p)}>
                    <ShoppingCart size={18} aria-label="Agregar al carrito" />
                  </button>
                </div>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
