import { money } from '@/data/catalog'
import { downloadCsv } from '@/lib/csv'
import { gtDate, todayGT } from '@/lib/dates'
import { ORDER_STATUS_LABEL } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import type { AdminData } from '../useAdminData'

const box = { background: '#222', padding: 10, borderRadius: 8 }

export function SalesTab({ data }: { data: AdminData }) {
  const { orders } = useStore()
  const { salesStats } = data

  function downloadOrdersCsv() {
    const header = ['Fecha pedido', 'Cliente', 'Estado', 'Sección', 'Plataforma o juego', 'Paquete', 'Cantidad', 'Precio unitario', 'Total línea', 'ID o WhatsApp', 'Referencia NC', 'Fecha depósito', 'Total pedido', 'Perfil', 'Vence', 'Renovación']
    const rows: string[][] = []
    for (const o of orders) {
      const items: (Item | null)[] = o.order_items && o.order_items.length > 0 ? o.order_items : [null]
      for (const it of items) {
        rows.push([
          gtDate(o.created_at),
          o.profiles?.full_name || o.user_id,
          ORDER_STATUS_LABEL[o.status] || o.status,
          it?.category || '',
          it?.game_name || o.products?.game_name || '',
          it?.product_name || o.products?.detail || '',
          String(it?.quantity ?? 1),
          it ? Number(it.unit_price).toFixed(2) : '',
          it ? Number(it.line_total).toFixed(2) : '',
          it?.player_id || o.player_id,
          o.reference_nc,
          o.deposit_date || '',
          Number(o.amount).toFixed(2),
          it?.delivery_profile || '',
          it?.valid_until || '',
          it?.renewal_of ? 'Sí' : '',
        ])
      }
    }
    downloadCsv(`pedidos-samuel-store-${todayGT()}.csv`, [header, ...rows])
  }

  return (
    <div className="admin-form" style={{ marginTop: 20 }}>
      <h3>Ventas</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={box}><p style={{ fontSize: 12, opacity: 0.8 }}>Total vendido</p><strong>{money(salesStats.total)}</strong></div>
        <div style={box}><p style={{ fontSize: 12, opacity: 0.8 }}>Este mes</p><strong>{money(salesStats.month)}</strong></div>
        <div style={box}><p style={{ fontSize: 12, opacity: 0.8 }}>Pendiente de aprobar</p><strong>{money(salesStats.pending)}</strong></div>
        <div style={box}><p style={{ fontSize: 12, opacity: 0.8 }}>Pedidos completados</p><strong>{salesStats.completedCount}</strong></div>
      </div>
      <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Solo cuentan los pedidos completados.</p>
      {salesStats.months.map(([m, v]) => (<p key={m}>{m}: <strong>{money(v)}</strong></p>))}
      <button className="button small" style={{ marginTop: 8 }} onClick={downloadOrdersCsv}>Descargar pedidos (Excel)</button>
    </div>
  )
}
