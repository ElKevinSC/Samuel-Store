// "Mi negocio": panel privado del revendedor (meta mensual, suscripciones y pedidos).
import { useMemo } from 'react'
import { ArrowRight, RefreshCw, ShoppingCart, Tv } from 'lucide-react'
import { money } from '@/data/catalog'
import { useMySubscriptions } from '@/features/streaming/useMySubscriptions'
import { ExpiringSubscriptions } from '@/features/streaming/ExpiringSubscriptions'
import { gtDate, fmtDate, prevMonthKey, todayGT } from '@/lib/dates'
import { OPEN_ORDER_STATUSES, RESELLER_MIN, orderStatusLabel } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'

const statBox = { border: '1px solid #194c6c', borderRadius: 12, padding: 12, background: '#101e2e' }

export function ResellerPanel() {
  const { user, myOrders, refreshMyOrders, setMessage, setModal } = useStore()
  const { counts } = useMySubscriptions()

  // Se calcula solo desde sus propios pedidos, ya filtrados por RLS.
  const stats = useMemo(() => {
    const currentMonth = todayGT().slice(0, 7)
    const previousMonth = prevMonthKey(currentMonth)
    let completedMonthAmount = 0
    let completedMonthCount = 0
    let previousMonthAmount = 0
    let pendingCount = 0
    for (const order of myOrders) {
      if (order.status === 'completed') {
        const month = gtDate(order.completed_at || order.created_at).slice(0, 7)
        const amount = Number(order.amount) || 0
        if (month === currentMonth) {
          completedMonthAmount += amount
          completedMonthCount += 1
        } else if (month === previousMonth) {
          previousMonthAmount += amount
        }
      } else if (OPEN_ORDER_STATUSES.includes(order.status)) {
        pendingCount += 1
      }
    }
    const remaining = Math.max(0, RESELLER_MIN - completedMonthAmount)
    const progress = Math.min(100, Math.max(0, Math.round((completedMonthAmount / RESELLER_MIN) * 100)))
    return { completedMonthAmount, completedMonthCount, previousMonthAmount, pendingCount, remaining, progress }
  }, [myOrders])

  if (!user) return null
  const activeSubs = counts.active + counts.expiring
  const openSubs = () => { setMessage(''); setModal('my_subs') }

  return (
    <section className="section wrap" id="reseller-panel" style={{ borderTop: '2px solid #00a3ff', marginTop: 40, paddingBottom: 36 }}>
      <div className="section-heading">
        <div>
          <h2>Mi negocio<span className="blue-text">.</span></h2>
          <p style={{ opacity: 0.8 }}>Panel exclusivo para revendedores de Samuel Store.</p>
        </div>
        <button type="button" className="button secondary small" onClick={() => { void refreshMyOrders() }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      <ExpiringSubscriptions variant="reseller" />

      <div className="admin-form" style={{ padding: 18, marginBottom: 14 }}>
        <h3>Mi meta mensual · {money(RESELLER_MIN)}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '14px 0' }}>
          <div style={statBox}>
            <p style={{ fontSize: 12, opacity: 0.8 }}>Compras completadas este mes</p>
            <strong style={{ color: '#31d6ff', fontSize: 21 }}>{money(stats.completedMonthAmount)}</strong>
          </div>
          <div style={statBox}>
            <p style={{ fontSize: 12, opacity: 0.8 }}>Falta para la meta</p>
            <strong style={{ fontSize: 21 }}>{money(stats.remaining)}</strong>
          </div>
          <div style={statBox}>
            <p style={{ fontSize: 12, opacity: 0.8 }}>Pedidos por revisar</p>
            <strong style={{ fontSize: 21 }}>{stats.pendingCount}</strong>
          </div>
        </div>
        <div role="progressbar" aria-label="Avance de compras mensuales" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100}
          style={{ width: '100%', height: 12, borderRadius: 20, background: '#243449', overflow: 'hidden' }}>
          <div style={{ width: `${stats.progress}%`, background: '#00a3ff', height: '100%', borderRadius: 20 }} />
        </div>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          {stats.remaining === 0 ? '¡Alcanzaste la meta de compras de este mes!' : `Llevas ${stats.progress}% de tu meta mensual.`}
        </p>
        <p style={{ fontSize: 12, opacity: 0.75 }}>
          Solo cuentan los pedidos completados. Mes anterior: {money(stats.previousMonthAmount)}. Compras completadas este mes: {stats.completedMonthCount}.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div className="admin-form" style={{ padding: 18 }}>
          <h3>Mis precios especiales</h3>
          <p>En el catálogo verás automáticamente los precios exclusivos de revendedor.</p>
          <button type="button" className="button small" onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}>
            <ShoppingCart size={16} /> Ver catálogo
          </button>
        </div>
        <div className="admin-form" style={{ padding: 18 }}>
          <h3>Mis cuentas de streaming</h3>
          <p>Tienes {activeSubs} cuenta{activeSubs === 1 ? '' : 's'} activa{activeSubs === 1 ? '' : 's'}. Cópialas o envíalas por WhatsApp a tus clientes.</p>
          <button type="button" className="button secondary small" onClick={openSubs}>
            <Tv size={16} /> Ver mis cuentas
          </button>
        </div>
      </div>

      <div className="admin-form" style={{ padding: 18 }}>
        <h3>Mis últimos pedidos</h3>
        <p style={{ fontSize: 13, opacity: 0.75 }}>Solo puedes consultar tus propios pedidos.</p>
        {myOrders.slice(0, 5).map(order => (
          <div key={order.id} style={{ padding: '12px 0', borderBottom: '1px solid #25415a' }}>
            <strong>{order.order_items?.[0]?.game_name || order.products?.game_name || 'Pedido'}</strong>
            <p style={{ fontSize: 13, margin: '4px 0' }}>{money(Number(order.amount) || 0)} · {fmtDate(gtDate(order.created_at))}</p>
            <p style={{ fontSize: 13, opacity: 0.85 }}>Estado: {orderStatusLabel(order.status)}</p>
          </div>
        ))}
        {myOrders.length === 0 && <p>Todavía no tienes pedidos registrados.</p>}
        <button type="button" className="button secondary small" style={{ marginTop: 12 }} onClick={() => { setMessage(''); setModal('my_orders') }}>
          Ver todos mis pedidos <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}
