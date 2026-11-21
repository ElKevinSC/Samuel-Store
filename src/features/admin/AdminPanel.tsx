// Panel de administración: menú de secciones y la sección activa.
import { useMemo, useState } from 'react'
import { summarizeInventory } from '@/features/inventory/inventory'
import { InventoryTab } from '@/features/inventory/InventoryTab'
import { STREAM_TYPE_LABEL } from '@/features/streaming/streaming'
import { useStore } from '@/store/StoreProvider'
import type { AdminTab } from '@/store/types'
import { BanksTab } from './tabs/BanksTab'
import { ClientsTab } from './tabs/ClientsTab'
import { PendingOrdersTab } from './tabs/PendingOrdersTab'
import { ProductsTab } from './tabs/ProductsTab'
import { ResellersTab } from './tabs/ResellersTab'
import { SalesTab } from './tabs/SalesTab'
import { StreamingSubsTab } from './tabs/StreamingSubsTab'
import { useAdminData } from './useAdminData'
import { useDeliveryDrafts } from './useDeliveryDrafts'

const TABS: [AdminTab, string][] = [
  ['inicio', '🏠 Inicio'], ['videojuegos', '🎮 Videojuegos'], ['streaming', '📺 Streaming'],
  ['inventario', '🗂️ Inventario'], ['pagos', '💳 Pagos'], ['ventas', '📊 Ventas'],
  ['revendedores', '👥 Revendedores'], ['productos', '📦 Productos'], ['bancos', '🏦 Bancos'], ['clientes', '👤 Clientes'],
]

export function AdminPanel() {
  const { message, refreshAdmin, inventory } = useStore()
  const [adminTab, setAdminTab] = useState<AdminTab>('inicio')
  const data = useAdminData()
  const drafts = useDeliveryDrafts()

  const lowStock = useMemo(() => summarizeInventory(inventory ?? []).filter(s => s.available <= 2), [inventory])
  const pendingStreaming = data.pendingOrders.filter(o => (o.order_items ?? []).some(it => it.category === 'Streaming')).length

  const badge = (id: AdminTab) => {
    const n = id === 'streaming' ? data.expiringSubs.length : id === 'pagos' ? data.pendingOrders.length : id === 'inventario' ? lowStock.length : 0
    return n > 0 ? ` (${n})` : ''
  }
  const goTo = (id: AdminTab) => { setAdminTab(id); if (id === 'revendedores') void refreshAdmin() }

  return (
    <section className="section wrap" id="admin-panel" style={{ borderTop: '2px solid #00a3ff', marginTop: 50, paddingBottom: 50 }}>
      <h2>Panel de administración</h2>
      <p style={{ opacity: 0.75 }}>Selecciona una sección para administrar tu tienda.</p>
      <button type="button" className="button small" onClick={() => setAdminTab('productos')}>
        + Crear producto
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, margin: '18px 0 24px' }}>
        {TABS.map(([id, title]) => (
          <button key={id} type="button" onClick={() => goTo(id)}
            className={adminTab === id ? 'button' : 'button secondary'}
            style={{ minHeight: 54, borderRadius: 12, fontSize: 13, whiteSpace: 'normal' }}>
            {title}{badge(id)}
          </button>
        ))}
      </div>
      {adminTab !== 'inicio' && <button type="button" className="button secondary small" style={{ marginBottom: 14 }} onClick={() => setAdminTab('inicio')}>← Volver al inicio</button>}

      {adminTab === 'inicio' && (
        <div className="admin-form">
          <h3>Bienvenido al panel</h3>
          <p>Elige una sección del menú. Los pedidos y herramientas están organizados por categoría.</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {pendingStreaming > 0 && (
              <button type="button" className="button secondary small" style={{ justifyContent: 'flex-start' }} onClick={() => setAdminTab('streaming')}>
                💳 {pendingStreaming} pedido{pendingStreaming === 1 ? '' : 's'} de streaming esperando que apruebes el pago
              </button>
            )}
            {data.expiringSubs.length > 0 && (
              <button type="button" className="button secondary small" style={{ justifyContent: 'flex-start' }} onClick={() => setAdminTab('streaming')}>
                ⏰ {data.expiringSubs.length} cuenta{data.expiringSubs.length === 1 ? '' : 's'} vence{data.expiringSubs.length === 1 ? '' : 'n'} en 5 días o menos
              </button>
            )}
            {lowStock.length > 0 && (
              <button type="button" className="button secondary small" style={{ justifyContent: 'flex-start' }} onClick={() => setAdminTab('inventario')}>
                🗂️ Poco inventario: {lowStock.map(s => `${s.platform} ${STREAM_TYPE_LABEL[s.type].toLowerCase()} (${s.available})`).join(', ')}
              </button>
            )}
          </div>
        </div>
      )}

      {(adminTab === 'pagos' || adminTab === 'videojuegos' || adminTab === 'streaming') && (
        <PendingOrdersTab tab={adminTab} data={data} drafts={drafts} onGoInventory={() => setAdminTab('inventario')} />
      )}
      {adminTab === 'streaming' && <StreamingSubsTab data={data} drafts={drafts} />}
      {adminTab === 'inventario' && <InventoryTab data={data} />}
      {adminTab === 'ventas' && <SalesTab data={data} />}
      {adminTab === 'revendedores' && <ResellersTab data={data} />}
      {adminTab === 'productos' && <ProductsTab data={data} />}
      {adminTab === 'bancos' && <BanksTab />}
      {adminTab === 'clientes' && <ClientsTab data={data} />}

      {message && <p role="status" style={{ color: '#00a3ff', marginTop: 12 }}>{message}</p>}
    </section>
  )
}
