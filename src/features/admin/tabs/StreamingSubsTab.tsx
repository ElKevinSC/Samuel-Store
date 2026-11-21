// Suscripciones de streaming entregadas: recordar, reenviar y corregir datos.
import { ExpiringAccounts } from '@/features/inventory/ExpiringAccounts'
import { deliveryText, itemDelivery } from '@/features/streaming/streaming'
import { daysLeft, fmtDate } from '@/lib/dates'
import { waLinkTo } from '@/lib/whatsapp'
import { OPEN_ORDER_STATUSES } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import type { AdminData } from '../useAdminData'
import type { DeliveryDrafts } from '../useDeliveryDrafts'

export function StreamingSubsTab({ data, drafts }: { data: AdminData; drafts: DeliveryDrafts }) {
  const { supabase, isAdmin, orders, showToast, refreshAdmin } = useStore()
  const { adminSubs, revokedCount } = data
  const { getDel, setDel, editingDeliveredId, startEditingDelivered, cancelEditingDelivered, savingDeliveredId, setSavingDeliveredId } = drafts

  async function saveDeliveredAccount(it: Item) {
    if (!isAdmin || savingDeliveredId) return
    const d = getDel(it)
    if (!d.email.trim() || !d.password.trim() || !d.profile.trim() || !d.valid_until) {
      showToast('Completa correo, contraseña, perfil y fecha de vencimiento.')
      return
    }
    const dateChanged = d.valid_until !== (it.valid_until ?? '')
    const hasPendingRenewal = orders.some(o =>
      OPEN_ORDER_STATUSES.includes(o.status) &&
      (o.order_items ?? []).some(item => item.renewal_of === it.id))
    if (dateChanged && hasPendingRenewal) {
      showToast('Hay una renovación pendiente. Resuélvela antes de cambiar la fecha.')
      return
    }
    if (!window.confirm('¿Guardar los cambios de esta cuenta de streaming? El cliente verá los datos nuevos.')) return
    setSavingDeliveredId(it.id)
    try {
      // Función solo para admin: actualiza al cliente y la copia del inventario a la vez.
      const { error } = await supabase.rpc('admin_edit_delivery', {
        p_item_id: it.id,
        p_email: d.email.trim(),
        p_password: d.password.trim(),
        p_profile: d.profile.trim(),
        p_pin: d.pin.trim(),
        p_valid_until: d.valid_until,
      })
      if (error) {
        showToast(`No se pudo guardar: ${error.message}`)
        return
      }
      cancelEditingDelivered(it.id)
      await refreshAdmin()
      showToast('Cuenta actualizada correctamente')
    } finally {
      setSavingDeliveredId(null)
    }
  }

  return (
    <>
      <ExpiringAccounts data={data} />

      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Suscripciones de streaming</h3>
        <div style={{ maxHeight: '50dvh', overflowY: 'auto' }}>
          {adminSubs.map(({ item, order }) => {
            const left = item.valid_until ? daysLeft(item.valid_until) : 0
            const d = itemDelivery(item)
            return (
              <div key={item.id} style={{ backgroundColor: '#222', padding: 10, margin: '5px 0', borderRadius: 8 }}>
                <strong>{item.game_name} - {item.delivery_profile || '—'}</strong>
                <p>{order.profiles?.full_name || 'Cliente'} | WhatsApp: {order.player_id}{item.end_customer_name ? ` | Para: ${item.end_customer_name}` : ''}</p>
                <p style={{ color: left <= 5 ? '#f06675' : undefined }}>Vence: {fmtDate(item.valid_until)} ({left < 0 ? `vencido hace ${-left} d` : `faltan ${left} d`})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <a className="button small secondary" href={waLinkTo(order.player_id, `Hola, tu ${item.game_name} - ${item.delivery_profile || ''} vence el ${fmtDate(item.valid_until)}. Puedes renovar desde la tienda con 5 días de anticipación.`)} target="_blank" rel="noreferrer">Recordar</a>
                  <a className="button small secondary" href={waLinkTo(order.player_id, deliveryText(item.game_name, d))} target="_blank" rel="noreferrer">Reenviar cuenta</a>
                  <button type="button" className="button small" onClick={() => startEditingDelivered(item)}>Editar cuenta</button>
                </div>
                {editingDeliveredId === item.id && (
                  <div style={{ display: 'grid', gap: 10, marginTop: 12, padding: 12, border: '1px solid #00a3ff', borderRadius: 10 }}>
                    <strong>Modificar datos de entrega</strong>
                    <label>Correo<input type="text" autoComplete="off" value={getDel(item).email} onChange={e => setDel(item, { email: e.target.value })} /></label>
                    <label>Contraseña<input type="text" autoComplete="off" value={getDel(item).password} onChange={e => setDel(item, { password: e.target.value })} /></label>
                    <label>Perfil<input type="text" value={getDel(item).profile} onChange={e => setDel(item, { profile: e.target.value })} /></label>
                    <label>PIN<input type="text" autoComplete="off" value={getDel(item).pin} onChange={e => setDel(item, { pin: e.target.value })} /></label>
                    <label>Fecha de vencimiento<input type="date" value={getDel(item).valid_until} onChange={e => setDel(item, { valid_until: e.target.value })} /></label>
                    <p style={{ fontSize: 12, opacity: 0.8 }}>
                      Si cambias la fecha, se actualizará también el vencimiento que ve el cliente.
                      Las renovaciones pendientes deben resolverse antes de modificarla.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button type="button" className="button small" disabled={savingDeliveredId === item.id} onClick={() => { void saveDeliveredAccount(item) }}>
                        {savingDeliveredId === item.id ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                      <button type="button" className="button small secondary" disabled={savingDeliveredId === item.id} onClick={() => cancelEditingDelivered(item.id)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {adminSubs.length === 0 && <p>Aún no hay suscripciones entregadas.</p>}
        </div>
        {revokedCount > 0 && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>{revokedCount} suscripción{revokedCount === 1 ? '' : 'es'} finalizada{revokedCount === 1 ? '' : 's'} (acceso retirado) no se muestra{revokedCount === 1 ? '' : 'n'}.</p>}
      </div>
    </>
  )
}
