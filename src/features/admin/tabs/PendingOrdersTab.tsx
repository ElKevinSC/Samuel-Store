// Pedidos pendientes: verificación de pagos, recargas de videojuegos y entregas de streaming.
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { money } from '@/data/catalog'
import { inventoryNeeds } from '@/features/inventory/inventory'
import { deliveryText } from '@/features/streaming/streaming'
import { fmtDate } from '@/lib/dates'
import { waLinkTo } from '@/lib/whatsapp'
import { useStore } from '@/store/StoreProvider'
import type { Order } from '@/store/types'
import type { AdminData } from '../useAdminData'
import type { DeliveryDrafts } from '../useDeliveryDrafts'

type Props = {
  tab: 'pagos' | 'videojuegos' | 'streaming'
  data: AdminData
  drafts: DeliveryDrafts
  onGoInventory: () => void
}

export function PendingOrdersTab({ tab, data, drafts, onGoInventory }: Props) {
  const { supabase, isAdmin, refreshAdmin, refreshStock, setMessage, showToast, stockByKey } = useStore()
  const { pendingOrders, itemsById, productsById } = data
  const { getDel, setDel } = drafts
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({})
  const [busyOrder, setBusyOrder] = useState<string | null>(null)

  const visible = pendingOrders.filter(o =>
    tab === 'pagos' || (o.order_items ?? []).some(it => it.category === (tab === 'videojuegos' ? 'Videojuegos' : 'Streaming')))

  async function updateOrder(id: string, status: 'completed' | 'rejected') {
    if (!window.confirm(status === 'completed' ? '¿Aprobar y completar este pedido?' : '¿Rechazar este pedido?')) return
    if (!isAdmin) return
    // La base de datos no permite editar pedidos directo: se usa una función solo para admin.
    const { error } = await supabase.rpc('admin_set_order_status', { p_order_id: id, p_status: status })
    if (error) setMessage(`No se pudo actualizar el pedido: ${error.message}`)
    else await refreshAdmin()
  }

  /** Entrega manual: el admin escribe los datos de cada cuenta. */
  async function completeDelivery(o: Order) {
    if (!isAdmin) return
    const items = (o.order_items ?? []).filter(it => it.category === 'Streaming' && !it.renewal_of)
    for (const it of items) {
      const d = getDel(it)
      if (!d.email.trim() || !d.password.trim() || !d.profile.trim() || !d.valid_until) {
        showToast('Completa correo, contraseña, perfil y fecha en cada perfil.')
        return
      }
    }
    if (!window.confirm('¿Guardar los datos de la cuenta y completar este pedido?')) return
    // Guarda todas las cuentas y completa el pedido en un solo paso.
    const deliveries = items.map(it => {
      const d = getDel(it)
      return { item_id: it.id, email: d.email.trim(), password: d.password.trim(), profile: d.profile.trim(), pin: d.pin.trim(), valid_until: d.valid_until }
    })
    const { error } = await supabase.rpc('admin_deliver_order', { p_order_id: o.id, p_deliveries: deliveries })
    if (error) showToast(`No se pudo completar el pedido: ${error.message}`)
    else {
      showToast('Pedido completado')
      await refreshAdmin()
    }
  }

  /** Entrega automática: la base de datos toma cuentas del inventario. */
  async function approveWithInventory(o: Order, units: number) {
    if (!isAdmin || busyOrder) return
    if (!window.confirm(`¿Confirmas que el pago sí llegó?\n\nSe entregarán ${units} cuenta${units === 1 ? '' : 's'} del inventario al panel del cliente y el pedido quedará completado.`)) return
    setBusyOrder(o.id)
    const { data: result, error } = await supabase.rpc('approve_order_with_inventory', { p_order_id: o.id })
    setBusyOrder(null)
    if (error) {
      setMessage(`No se pudo entregar: ${error.message}`)
      showToast('No se pudo entregar. Revisa el mensaje al final del panel.')
      await refreshStock()
      return
    }
    const delivered = Number((result as { delivered?: number } | null)?.delivered ?? units)
    setMessage('')
    showToast(`Pago aprobado: se entregaron ${delivered} cuenta${delivered === 1 ? '' : 's'}.`)
    await refreshAdmin()
  }

  return (
    <div className="admin-form" style={{ marginTop: 20 }}>
      <h3>{tab === 'videojuegos' ? 'Pedidos de videojuegos' : tab === 'streaming' ? 'Pedidos de streaming' : 'Verificación de pagos'}</h3>
      <div style={{ maxHeight: '75dvh', overflowY: 'auto' }}>
        {visible.map(o => {
          const items = o.order_items ?? []
          const first = items[0]
          const isWa = first?.contact_type === 'whatsapp'
          const isStream = first?.category === 'Streaming'
          const renewals = items.filter(it => it.renewal_of)
          const toDeliver = items.filter(it => it.category === 'Streaming' && !it.renewal_of)
          const needs = inventoryNeeds(toDeliver, productsById, stockByKey)
          const units = needs.reduce((t, n) => t + n.needed, 0)
          const covered = toDeliver.length > 0 && needs.every(n => n.available >= n.needed)
          const anyTracked = needs.some(n => n.tracked)
          const showManual = toDeliver.length > 0 && (!covered || manualOpen[o.id])
          return (
            <div key={o.id} className="admin-product-row" style={{ backgroundColor: '#222', padding: 10, margin: '5px 0', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <p><strong>Cliente:</strong> {o.profiles?.full_name || o.user_id}</p>
              <p><strong>{isStream ? 'Plataforma' : 'Juego'}:</strong> {first?.game_name || o.products?.game_name || '—'}{renewals.length > 0 ? ' (RENOVACIÓN)' : ''}</p>
              <div style={{ background: '#111', padding: 8, borderRadius: 6, width: '100%' }}>
                <strong>{isStream ? 'Entregar:' : 'Recargar:'}</strong>
                {items.map((it, i) => (
                  <p key={i}>{it.quantity} × {it.product_name}{it.renewal_of ? ' (renovación)' : ''} — {money(Number(it.line_total))}</p>
                ))}
                {items.length === 0 && <p>{o.products?.detail || '—'}</p>}
              </div>
              {isWa ? (
                <p>
                  <strong>WhatsApp:</strong> {o.player_id}{' '}
                  <a href={waLinkTo(o.player_id, `Hola ${o.profiles?.full_name || ''}, te escribimos de Samuel Store por tu pedido.`)} target="_blank" rel="noreferrer" style={{ color: '#25d366', textDecoration: 'underline' }}>Escribir</a>
                </p>
              ) : (
                <p><strong>ID jugador:</strong> {o.player_id}</p>
              )}
              <p><strong>Monto:</strong> {money(Number(o.amount))} | <strong>NC:</strong> {o.reference_nc}</p>
              <p><strong>Fecha depósito:</strong> {o.deposit_date || '—'}</p>
              {o.receipt_signed_url ? (
                <a href={o.receipt_signed_url} target="_blank" rel="noreferrer" style={{ color: '#00a3ff', textDecoration: 'underline' }}>Ver comprobante</a>
              ) : <p>No se pudo crear enlace para la boleta.</p>}
              {renewals.map(it => {
                const orig = it.renewal_of ? itemsById.get(it.renewal_of) : undefined
                return (
                  <p key={it.id} style={{ color: '#ffcc00' }}>
                    Vence actualmente: {fmtDate(orig?.valid_until)}. Al aprobar se suman {it.duration_days ?? 30} días.
                  </p>
                )
              })}

              {toDeliver.length > 0 && (
                <div style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${covered ? '#25d366' : '#ffcc00'}` }}>
                  <strong>Inventario</strong>
                  {needs.map(n => (
                    <p key={n.key} style={{ fontSize: 13, color: n.available >= n.needed ? '#25d366' : '#ffcc00' }}>
                      {n.label}: necesita {n.needed}, hay {n.available} disponible{n.available === 1 ? '' : 's'}
                    </p>
                  ))}
                  {covered ? (
                    <p style={{ fontSize: 12, opacity: 0.8 }}>Al aprobar, cada cuenta llega sola al panel del cliente con su vencimiento.</p>
                  ) : (
                    <p style={{ fontSize: 12, opacity: 0.8 }}>
                      {anyTracked ? 'No alcanza el inventario. ' : 'Esta plataforma aún no tiene cuentas en inventario. '}
                      <button type="button" onClick={onGoInventory} style={{ textDecoration: 'underline' }}>Agregar cuentas</button> o entrégalo manualmente abajo.
                    </p>
                  )}
                </div>
              )}

              {showManual && toDeliver.map(it => {
                const d = getDel(it)
                return (
                  <div key={it.id} style={{ background: '#111', padding: 8, borderRadius: 6, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <strong>{it.game_name} — datos de la cuenta</strong>
                    <input placeholder="Correo de la cuenta" value={d.email} onChange={e => setDel(it, { email: e.target.value })} />
                    <input placeholder="Contraseña" value={d.password} onChange={e => setDel(it, { password: e.target.value })} />
                    <input placeholder="Perfil (Ej. P2)" value={d.profile} onChange={e => setDel(it, { profile: e.target.value })} />
                    <input placeholder="PIN (opcional)" value={d.pin} onChange={e => setDel(it, { pin: e.target.value })} />
                    <label>Válido hasta<input type="date" value={d.valid_until} onChange={e => setDel(it, { valid_until: e.target.value })} /></label>
                    {d.email && d.password && d.profile && d.valid_until && (
                      <a className="button small secondary" href={waLinkTo(o.player_id, deliveryText(it.game_name, d))} target="_blank" rel="noreferrer">Enviar cuenta por WhatsApp</a>
                    )}
                  </div>
                )
              })}

              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {toDeliver.length > 0 ? (
                  <>
                    {covered && (
                      <button className="button small" disabled={busyOrder === o.id} onClick={() => { void approveWithInventory(o, units) }}>
                        {busyOrder === o.id ? 'Entregando…' : 'Aprobar pago y entregar'}
                      </button>
                    )}
                    {covered && !manualOpen[o.id] && (
                      <button className="button small secondary" onClick={() => setManualOpen(m => ({ ...m, [o.id]: true }))}>Entregar manualmente</button>
                    )}
                    {showManual && <button className="button small" onClick={() => { void completeDelivery(o) }}>Entregar y completar</button>}
                  </>
                ) : (
                  <button className="button small" onClick={() => { void updateOrder(o.id, 'completed') }}>{renewals.length > 0 ? 'Aprobar renovación' : 'Aprobar y completar'}</button>
                )}
                <button className="button small" onClick={() => { void updateOrder(o.id, 'rejected') }}>Rechazar</button>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <p>No hay pedidos pendientes en esta sección.</p>}
      </div>
      <button className="button secondary small" onClick={() => { void refreshAdmin() }}><RefreshCw size={14} /> Actualizar</button>
    </div>
  )
}
