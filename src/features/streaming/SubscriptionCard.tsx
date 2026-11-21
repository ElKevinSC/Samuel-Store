// Tarjeta de una cuenta entregada, vista por el cliente o distribuidor.
import { useState } from 'react'
import { Bell, Copy, MessageCircle, UserRound } from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import { daysLeft, fmtDate, todayGT } from '@/lib/dates'
import { waLinkOrShare } from '@/lib/whatsapp'
import { EXPIRY_WINDOW_DAYS } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import { SUB_STATE_LABEL, deliveryText, itemDelivery, reminderText, subState } from './streaming'

type Props = {
  it: Item
  waitingRenewal: boolean
  canLabel: boolean
  onRenew: (it: Item) => void
}

export function SubscriptionCard({ it, waitingRenewal, canLabel, onRenew }: Props) {
  const { supabase, showToast, refreshMyOrders } = useStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(it.end_customer_name ?? '')
  const [phone, setPhone] = useState(it.end_customer_phone ?? '')
  const [saving, setSaving] = useState(false)

  const state = subState(it)
  const badge = SUB_STATE_LABEL[state]
  const left = daysLeft(it.valid_until ?? todayGT())
  const revoked = state === 'revoked'
  const text = deliveryText(it.game_name, itemDelivery(it))
  const endPhone = it.end_customer_phone

  async function copy(t: string, what: string) {
    showToast((await copyText(t)) ? `${what} copiados` : 'No se pudo copiar. Mantén presionado el texto para copiarlo.')
  }

  async function saveCustomer() {
    setSaving(true)
    const { error } = await supabase.rpc('set_end_customer', { p_item_id: it.id, p_name: name, p_phone: phone })
    setSaving(false)
    if (error) { showToast(`No se pudo guardar: ${error.message}`); return }
    setEditing(false)
    showToast('Cliente guardado')
    await refreshMyOrders()
  }

  return (
    <div style={{ borderBottom: '1px solid #333', padding: '12px 0', opacity: revoked ? 0.65 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <p><strong>{it.game_name} - {it.delivery_profile}</strong></p>
        <span style={{ fontSize: 12, color: badge.color, whiteSpace: 'nowrap' }}>● {badge.text}</span>
      </div>

      {canLabel && (it.end_customer_name || it.end_customer_phone) && !editing && (
        <p style={{ fontSize: 13, opacity: 0.85 }}><UserRound size={13} style={{ verticalAlign: '-2px' }} /> {it.end_customer_name || 'Cliente'}{it.end_customer_phone ? ` · ${it.end_customer_phone}` : ''}</p>
      )}

      {revoked ? (
        <p style={{ fontSize: 13 }}>Este acceso finalizó el {fmtDate(it.access_revoked_at)}. Haz un pedido nuevo si deseas continuar.</p>
      ) : (
        <>
          <p>📩 Correo: {it.delivery_email}</p>
          <p>🔑 Contraseña: {it.delivery_password}</p>
          <p>👥 Perfil: {it.delivery_profile}</p>
          {it.delivery_pin && <p>🚨 Pin: {it.delivery_pin}</p>}
          <p>Válido hasta {fmtDate(it.valid_until)}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
            <button type="button" className="button small secondary" onClick={() => { void copy(text, 'Datos') }}><Copy size={14} /> Copiar datos</button>
            <a className="button small secondary" href={waLinkOrShare(endPhone, text)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Enviar por WhatsApp</a>
            {state !== 'active' && (
              <a className="button small secondary" href={waLinkOrShare(endPhone, reminderText(it))} target="_blank" rel="noreferrer"><Bell size={14} /> Recordatorio</a>
            )}
            {canLabel && !editing && (
              <button type="button" className="button small secondary" onClick={() => setEditing(true)}><UserRound size={14} /> {it.end_customer_name || it.end_customer_phone ? 'Editar cliente' : '¿Para quién es?'}</button>
            )}
          </div>

          {editing && (
            <div style={{ display: 'grid', gap: 8, padding: 10, border: '1px solid #00a3ff', borderRadius: 10, margin: '6px 0' }}>
              <label>Nombre de tu cliente<input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Doña Marta" /></label>
              <label>WhatsApp de tu cliente<input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej. 55551234" /></label>
              <p style={{ fontSize: 12, opacity: 0.75 }}>Con su número, los botones de WhatsApp le escriben directo a esa persona.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="button small" disabled={saving} onClick={() => { void saveCustomer() }}>{saving ? 'Guardando…' : 'Guardar'}</button>
                <button type="button" className="button small secondary" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {left > EXPIRY_WINDOW_DAYS && <p>Faltan {left} días. Podrás renovar cuando falten {EXPIRY_WINDOW_DAYS} días.</p>}
          {left >= 1 && left <= EXPIRY_WINDOW_DAYS && (
            <>
              <p style={{ color: 'orange' }}>Faltan {left} {left === 1 ? 'día' : 'días'}.</p>
              {waitingRenewal ? <p>Renovación en revisión.</p> : <button className="button small" onClick={() => onRenew(it)}>Renovar</button>}
            </>
          )}
          {left === 0 && <p style={{ color: 'red' }}>Vence hoy. Ya no se puede renovar.</p>}
          {left < 0 && <p style={{ color: 'red' }}>Vencido. Escríbenos por WhatsApp para un nuevo servicio.</p>}
        </>
      )}
    </div>
  )
}
