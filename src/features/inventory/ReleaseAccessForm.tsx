// Quitar acceso al cliente, poner PIN o contraseña nuevos y devolver la cuenta al inventario.
import { useState } from 'react'
import { STREAM_TYPE_LABEL, platformKey } from '@/features/streaming/streaming'
import { useStore } from '@/store/StoreProvider'
import type { Subscription } from '@/store/types'
import type { AdminData } from '@/features/admin/useAdminData'
import { itemStreamType } from './inventory'

type Props = { sub: Subscription; data: AdminData; onDone: () => void; onCancel: () => void }

export function ReleaseAccessForm({ sub, data, onDone, onCancel }: Props) {
  const { supabase, showToast, setMessage, refreshAdmin } = useStore()
  const { adminSubs, productsById, pendingRenewalOf } = data
  const { item, order } = sub
  const type = itemStreamType(item, productsById)
  const [newPin, setNewPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // Otros clientes que usan la misma cuenta (mismo correo y plataforma).
  const sharing = adminSubs.filter(s =>
    s.item.id !== item.id &&
    platformKey(s.item.game_name) === platformKey(item.game_name) &&
    (s.item.delivery_email ?? '').trim().toLowerCase() === (item.delivery_email ?? '').trim().toLowerCase()).length
  const hasPendingRenewal = pendingRenewalOf.has(item.id)

  async function release() {
    if (!newPin.trim() && !newPassword.trim()) {
      showToast(type === 'full' ? 'Escribe la nueva contraseña.' : 'Escribe el nuevo PIN (o una contraseña nueva).')
      return
    }
    const warn = newPassword.trim() && sharing > 0
      ? `\n\nOJO: ${sharing} cliente${sharing === 1 ? '' : 's'} más usa${sharing === 1 ? '' : 'n'} esta cuenta. Verán la contraseña nueva en su panel.`
      : ''
    if (!window.confirm(`¿Quitar el acceso de ${order.profiles?.full_name || 'este cliente'} a ${item.game_name} - ${item.delivery_profile}?\n\nLa cuenta volverá al inventario con los datos nuevos, lista para otra venta.${warn}`)) return
    setSaving(true)
    const { data, error } = await supabase.rpc('release_streaming_access', {
      p_item_id: item.id,
      p_new_password: newPassword.trim() || null,
      p_new_pin: newPin.trim() || null,
    })
    setSaving(false)
    if (error) {
      setMessage(`No se pudo quitar el acceso: ${error.message}`)
      showToast(error.message)
      return
    }
    const others = Number((data as { updated_customers?: number } | null)?.updated_customers ?? 0)
    showToast(`Acceso retirado. La cuenta volvió al inventario.${others > 0 ? ` Se actualizó la contraseña de ${others} cliente${others === 1 ? '' : 's'} más.` : ''}`)
    await refreshAdmin()
    onDone()
  }

  if (hasPendingRenewal) {
    return <p style={{ color: '#ffcc00', fontSize: 13 }}>Este cliente tiene una renovación en revisión. Apruébala o recházala antes de quitar el acceso.</p>
  }

  const pinField = <label>Nuevo PIN del perfil<input autoComplete="off" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Ej. 4821" /></label>
  const passField = (
    <label>Nueva contraseña {type === 'profile' && <small>(opcional)</small>}
      <input autoComplete="off" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Déjala vacía si no la cambiaste" />
    </label>
  )

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10, padding: 12, border: '1px solid #f06675', borderRadius: 10 }}>
      <strong>Quitar acceso · {item.game_name} ({STREAM_TYPE_LABEL[type]})</strong>
      <p style={{ fontSize: 12, opacity: 0.8 }}>
        Primero cambia {type === 'full' ? 'la contraseña' : 'el PIN'} en la plataforma y escríbelo aquí. Al guardar, el cliente deja de ver los datos y la cuenta queda disponible para una venta nueva.
      </p>
      {type === 'full' ? <>{passField}{pinField}</> : <>{pinField}{passField}</>}
      {sharing > 0 && (
        <p style={{ fontSize: 12, color: '#ffcc00' }}>
          {sharing} perfil{sharing === 1 ? '' : 'es'} más de esta cuenta {sharing === 1 ? 'está' : 'están'} en uso. Si cambias la contraseña, se les actualiza automáticamente en su panel.
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="button small" disabled={saving} onClick={() => { void release() }}>{saving ? 'Guardando…' : 'Quitar acceso y liberar'}</button>
        <button type="button" className="button small secondary" disabled={saving} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
