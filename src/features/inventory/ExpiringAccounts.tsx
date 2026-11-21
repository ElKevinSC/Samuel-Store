// Cuentas que vencen en 5 días o menos, con recordatorio y "Quitar acceso".
import { useState } from 'react'
import { daysLeft, fmtDate } from '@/lib/dates'
import { waLinkTo } from '@/lib/whatsapp'
import { EXPIRY_WINDOW_DAYS } from '@/store/constants'
import type { AdminData } from '@/features/admin/useAdminData'
import { ReleaseAccessForm } from './ReleaseAccessForm'

export function ExpiringAccounts({ data }: { data: AdminData }) {
  const { expiringSubs, pendingRenewalOf } = data
  const [releasing, setReleasing] = useState<string | null>(null)

  return (
    <div className="admin-form" style={{ marginTop: 20, border: expiringSubs.length ? '1px solid #f06675' : undefined }}>
      <h3>⏰ Por vencer ({expiringSubs.length})</h3>
      <p style={{ fontSize: 12, opacity: 0.8 }}>
        Cuentas que vencen en {EXPIRY_WINDOW_DAYS} días o menos, y las vencidas que siguen activas. Cuando no renueven, quita el acceso para volver a venderla.
      </p>
      <div style={{ maxHeight: '55dvh', overflowY: 'auto' }}>
        {expiringSubs.map(({ item, order }) => {
          const left = daysLeft(item.valid_until ?? '')
          const renewing = pendingRenewalOf.has(item.id)
          return (
            <div key={item.id} style={{ backgroundColor: '#222', padding: 10, margin: '6px 0', borderRadius: 8 }}>
              <strong>{item.game_name} - {item.delivery_profile || '—'}</strong>
              <p style={{ fontSize: 13 }}>{order.profiles?.full_name || 'Cliente'} | WhatsApp: {order.player_id}{item.end_customer_name ? ` | Para: ${item.end_customer_name}` : ''}</p>
              <p style={{ color: left < 0 ? '#f06675' : '#ffcc00', fontSize: 13 }}>
                Vence: {fmtDate(item.valid_until)} ({left < 0 ? `vencido hace ${-left} d` : left === 0 ? 'hoy' : `faltan ${left} d`})
                {renewing && <span style={{ color: '#25d366' }}> · renovación en revisión</span>}
                {!item.inventory_account_id && <span style={{ opacity: 0.7 }}> · entregada a mano</span>}
              </p>
              {releasing !== item.id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <a className="button small secondary" href={waLinkTo(order.player_id, `Hola, tu ${item.game_name} - ${item.delivery_profile || ''} vence el ${fmtDate(item.valid_until)}. Puedes renovar desde la tienda con 5 días de anticipación.`)} target="_blank" rel="noreferrer">Recordar</a>
                  <button type="button" className="button small" disabled={renewing} style={renewing ? { opacity: 0.5 } : undefined} onClick={() => setReleasing(item.id)}>Quitar acceso</button>
                </div>
              )}
              {releasing === item.id && (
                <ReleaseAccessForm sub={{ item, order }} data={data} onDone={() => setReleasing(null)} onCancel={() => setReleasing(null)} />
              )}
            </div>
          )
        })}
        {expiringSubs.length === 0 && <p>Ninguna cuenta vence en los próximos {EXPIRY_WINDOW_DAYS} días. 👌</p>}
      </div>
    </div>
  )
}
