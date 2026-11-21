// "Por vencer": cuentas del usuario que vencen en 5 días o menos, con botón
// para renovar. El revendedor además ve "Recordatorio" para avisarle a su cliente.
import { useMemo } from 'react'
import { Bell, RefreshCw } from 'lucide-react'
import { daysLeft, fmtDate } from '@/lib/dates'
import { waLinkOrShare } from '@/lib/whatsapp'
import { EXPIRY_WINDOW_DAYS } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import { reminderText, subState } from './streaming'
import { useMySubscriptions } from './useMySubscriptions'

type Props = { variant: 'reseller' | 'customer' }

export function ExpiringSubscriptions({ variant }: Props) {
  const { setRenewItem, setMessage, setModal } = useStore()
  const { mySubs, pendingRenewals } = useMySubscriptions()
  const isReseller = variant === 'reseller'

  // Por vencer (0 a 5 días) y vencidas que todavía no se retiran.
  const expiring = useMemo(
    () => mySubs.filter(it => ['expiring', 'expired'].includes(subState(it))),
    [mySubs],
  )

  // Al cliente solo se le muestra cuando tiene algo por vencer.
  if (!isReseller && expiring.length === 0) return null

  function renew(it: Item) {
    setRenewItem(it)
    setMessage('')
    setModal('renew')
  }

  return (
    <div className="admin-form" style={{ padding: 18, marginBottom: 14, border: expiring.length ? '1px solid #f06675' : undefined }}>
      <h3>⏰ Por vencer ({expiring.length})</h3>
      <p style={{ fontSize: 12, opacity: 0.8 }}>
        {isReseller
          ? `Cuentas que vencen en ${EXPIRY_WINDOW_DAYS} días o menos. Mándale un recordatorio a tu cliente y renueva antes de que venza.`
          : `Tu servicio vence pronto. Renueva antes de la fecha para no perder el acceso.`}
      </p>
      <div style={{ maxHeight: '55dvh', overflowY: 'auto' }}>
        {expiring.map(it => {
          const left = daysLeft(it.valid_until ?? '')
          const waiting = pendingRenewals.has(it.id)
          return (
            <div key={it.id} style={{ background: '#101e2e', border: '1px solid #194c6c', borderRadius: 10, padding: 12, margin: '8px 0' }}>
              <strong>{it.game_name} - {it.delivery_profile || '—'}</strong>
              {isReseller && (it.end_customer_name || it.end_customer_phone) && (
                <p style={{ fontSize: 13, opacity: 0.85 }}>Para: {it.end_customer_name || 'Cliente'}{it.end_customer_phone ? ` · ${it.end_customer_phone}` : ''}</p>
              )}
              <p style={{ fontSize: 13, color: left < 0 ? '#f06675' : '#ffcc00' }}>
                Vence: {fmtDate(it.valid_until)} ({left < 0 ? `vencida hace ${-left} d` : left === 0 ? 'vence hoy' : `faltan ${left} d`})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {isReseller && (
                  <a className="button small secondary" href={waLinkOrShare(it.end_customer_phone, reminderText(it))} target="_blank" rel="noreferrer">
                    <Bell size={14} /> Recordatorio
                  </a>
                )}
                {waiting ? (
                  <span style={{ fontSize: 13, color: '#25d366', alignSelf: 'center' }}>Renovación en revisión</span>
                ) : left >= 1 ? (
                  <button type="button" className="button small" onClick={() => renew(it)}><RefreshCw size={14} /> Renovar</button>
                ) : (
                  <span style={{ fontSize: 12, opacity: 0.8, alignSelf: 'center' }}>Ya no se puede renovar. Escríbenos por WhatsApp.</span>
                )}
              </div>
            </div>
          )
        })}
        {expiring.length === 0 && <p>Ninguna cuenta vence en los próximos {EXPIRY_WINDOW_DAYS} días. 👌</p>}
      </div>
    </div>
  )
}

/** Aviso para clientes normales, arriba del catálogo. Solo aparece si hay algo por vencer. */
export function CustomerExpiringSection() {
  return (
    <section className="section wrap" id="por-vencer" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <ExpiringSubscriptions variant="customer" />
    </section>
  )
}
