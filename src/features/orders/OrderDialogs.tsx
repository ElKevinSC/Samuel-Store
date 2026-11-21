// Diálogos de pedidos: confirmación, "Mis pedidos" e historial de un usuario (admin).
import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { money } from '@/data/catalog'
import { StreamingConditions } from '@/features/streaming/StreamingConditions'
import { orderStatusColor, orderStatusLabel } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Order } from '@/store/types'

function OrderLines({ o }: { o: Order }) {
  return (
    <>
      {(o.order_items ?? []).map((it, i) => (
        <p key={i}>{it.quantity} × {it.product_name}{it.renewal_of ? ' (renovación)' : ''} — {money(Number(it.line_total))}</p>
      ))}
      {(!o.order_items || o.order_items.length === 0) && <p>{o.products?.detail || '—'}</p>}
    </>
  )
}

const contactLabel = (o: Order) => (o.order_items?.[0]?.contact_type === 'whatsapp' ? 'WhatsApp' : 'ID jugador')
const orderTitle = (o: Order) => o.order_items?.[0]?.game_name || o.products?.game_name || 'Pedido'

function StatusLine({ status }: { status: string }) {
  return <p>Estado: <strong style={{ color: orderStatusColor(status) }}>{orderStatusLabel(status)}</strong></p>
}

export function OrderDoneDialog() {
  const { lastOrder, setModal } = useStore()
  return (
    <>
      <DialogHeader><DialogTitle>¡Pedido enviado!</DialogTitle><DialogDescription>Recibimos tu comprobante. Para que sea más rápido, envíanos el detalle por WhatsApp.</DialogDescription></DialogHeader>
      <div className="auth-form">
        {lastOrder.isStreaming && (
          <>
            <p style={{ fontSize: 13 }}>Cuando aprobemos tu pago, los datos de tus cuentas aparecerán en <strong>Mis suscripciones</strong>.</p>
            <StreamingConditions />
          </>
        )}
        <a className="button" href={lastOrder.waLink} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp</a>
        <button className="button secondary small" onClick={() => setModal('my_orders')}>Ver mis pedidos</button>
      </div>
    </>
  )
}

export function MyOrdersDialog() {
  const { myOrders, refreshMyOrders } = useStore()
  return (
    <>
      <DialogHeader><DialogTitle>Mis pedidos</DialogTitle></DialogHeader>
      <div style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
        {myOrders.map(o => (
          <div key={o.id} style={{ borderBottom: '1px solid #333', padding: '10px 0' }}>
            <p><strong>{orderTitle(o)}</strong></p>
            <OrderLines o={o} />
            <p>{contactLabel(o)}: <strong>{o.player_id}</strong></p>
            <p>Total: <strong>{money(Number(o.amount))}</strong> | {new Date(o.created_at).toLocaleDateString()}</p>
            <StatusLine status={o.status} />
          </div>
        ))}
        {myOrders.length === 0 && <p>No tienes pedidos aún.</p>}
      </div>
      <button className="button secondary small" onClick={() => { void refreshMyOrders() }}><RefreshCw size={14} /> Actualizar</button>
    </>
  )
}

export function UserOrdersDialog() {
  const { orders, historyUser, setModal } = useStore()
  const historyOrders = useMemo(() => orders.filter(o => o.user_id === historyUser), [orders, historyUser])
  const name = historyOrders[0]?.profiles?.full_name || 'Pedidos del usuario'
  return (
    <>
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>Historial de pedidos</DialogDescription>
      </DialogHeader>
      <div style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
        {historyOrders.map(o => (
          <div key={o.id} style={{ borderBottom: '1px solid #333', padding: '12px 0' }}>
            <p><strong>{orderTitle(o)}</strong> — {new Date(o.created_at).toLocaleDateString()}</p>
            <p>{contactLabel(o)}: <strong>{o.player_id}</strong></p>
            <OrderLines o={o} />
            <p>Total: <strong>{money(Number(o.amount))}</strong> | NC: {o.reference_nc}</p>
            <StatusLine status={o.status} />
            {o.receipt_signed_url && <a href={o.receipt_signed_url} target="_blank" rel="noreferrer" style={{ color: '#00a3ff', textDecoration: 'underline' }}>Ver comprobante</a>}
          </div>
        ))}
        {historyOrders.length === 0 && <p>Sin pedidos.</p>}
      </div>
      <button className="button secondary small" onClick={() => setModal(null)}>Cerrar</button>
    </>
  )
}
