import { money } from '@/data/catalog'
import { useStore } from '@/store/StoreProvider'
import { stockProblem } from './cart-rules'

export function CartPanel() {
  const { cart, unitPrice, cartTotal, changeCartQuantity, clearCart, openCheckout, stockByKey, showToast } = useStore()
  if (cart.length === 0) return null

  function increase(productId: string, quantity: number) {
    const line = cart.find(l => l.product.id === productId)
    const problem = line ? stockProblem(cart, line.product, stockByKey) : null
    if (problem) { showToast(problem); return }
    changeCartQuantity(productId, quantity + 1)
  }

  return (
    <div className="admin-form" style={{ marginTop: 20, padding: 16, border: '1px solid #00a3ff', borderRadius: 12 }}>
      <h3>🛒 Mi carrito ({cart.length} paquetes)</h3>

      {cart.map(item => (
        <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #333' }}>
          <div>
            <strong>{item.product.detail || item.product.name}</strong>
            <p>{money(unitPrice(item.product) * item.quantity)}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="button small" onClick={() => changeCartQuantity(item.product.id, item.quantity - 1)}>−</button>
            <span>{item.quantity}</span>
            <button className="button small" onClick={() => increase(item.product.id, item.quantity)}>+</button>
          </div>
        </div>
      ))}

      <h3>Total: {money(cartTotal)}</h3>

      <button className="button" onClick={() => openCheckout('El carrito está listo.')}>
        Continuar al pago
      </button>
      <button className="button secondary small" style={{ marginLeft: 8 }} onClick={clearCart}>
        Vaciar carrito
      </button>
    </div>
  )
}
