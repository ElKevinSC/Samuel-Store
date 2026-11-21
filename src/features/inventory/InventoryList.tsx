// Lista del inventario con filtros y acciones por cuenta.
import { useMemo, useState } from 'react'
import { STREAM_TYPE_LABEL, platformKey } from '@/features/streaming/streaming'
import type { AdminData } from '@/features/admin/useAdminData'
import { daysLeft, fmtDate } from '@/lib/dates'
import { useStore } from '@/store/StoreProvider'
import type { InventoryAccount } from '@/store/types'
import { ReleaseAccessForm } from './ReleaseAccessForm'

type StatusFilter = 'all' | InventoryAccount['status']
const STATUS_LABEL: Record<InventoryAccount['status'], { text: string; color: string }> = {
  available: { text: 'Disponible', color: '#25d366' },
  assigned: { text: 'Vendida', color: '#00a3ff' },
  disabled: { text: 'Desactivada', color: '#8b98a8' },
}

type Draft = { email: string; password: string; profile_name: string; pin: string }

export function InventoryList({ data }: { data: AdminData }) {
  const { supabase, inventory, showToast, refreshAdmin } = useStore()
  const { subsByItemId } = data
  const [platform, setPlatform] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ email: '', password: '', profile_name: '', pin: '' })
  const [releasing, setReleasing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const list = inventory ?? []
  const platforms = useMemo(() => Array.from(new Map(list.map(a => [platformKey(a.platform), a.platform.trim()])).entries()), [list])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return list.filter(a =>
      (platform === 'all' || platformKey(a.platform) === platform) &&
      (status === 'all' || a.status === status) &&
      (!term || [a.email, a.profile_name, a.pin].some(v => (v ?? '').toLowerCase().includes(term))))
  }, [list, platform, status, search])

  async function run(id: string, action: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(id)
    const { error } = await action()
    setBusy(null)
    if (error) { showToast(`No se pudo: ${error.message}`); return false }
    showToast(ok)
    await refreshAdmin()
    return true
  }

  function startEdit(a: InventoryAccount) {
    setEditing(a.id)
    setDraft({ email: a.email, password: a.password, profile_name: a.profile_name ?? '', pin: a.pin ?? '' })
  }

  async function saveEdit(a: InventoryAccount) {
    if (!draft.email.trim() || !draft.password.trim()) { showToast('Correo y contraseña son obligatorios.'); return }
    if (a.stream_type === 'profile' && !draft.profile_name.trim()) { showToast('Escribe el nombre del perfil.'); return }
    const patch = {
      email: draft.email.trim(), password: draft.password.trim(),
      profile_name: a.stream_type === 'profile' ? draft.profile_name.trim() : null,
      pin: draft.pin.trim() || null, updated_at: new Date().toISOString(),
    }
    if (await run(a.id, () => supabase.from('streaming_accounts').update(patch).eq('id', a.id), 'Cuenta actualizada')) setEditing(null)
  }

  function remove(a: InventoryAccount) {
    if (!window.confirm(`¿Eliminar ${a.platform} · ${a.profile_name || a.email} del inventario?`)) return
    void run(a.id, () => supabase.from('streaming_accounts').delete().eq('id', a.id), 'Eliminada del inventario')
  }

  function toggle(a: InventoryAccount) {
    const next = a.status === 'disabled' ? 'available' : 'disabled'
    void run(a.id, () => supabase.from('streaming_accounts').update({ status: next, updated_at: new Date().toISOString() }).eq('id', a.id),
      next === 'available' ? 'Cuenta activada' : 'Cuenta desactivada: no se entregará')
  }

  return (
    <div className="admin-form" style={{ marginTop: 20 }}>
      <h3>Cuentas en inventario ({list.length})</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <select value={platform} onChange={e => setPlatform(e.target.value)} aria-label="Plataforma">
          <option value="all">Todas las plataformas</option>
          {platforms.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="Estado">
          <option value="all">Todos los estados</option>
          <option value="available">Disponibles</option>
          <option value="assigned">Vendidas</option>
          <option value="disabled">Desactivadas</option>
        </select>
        <input placeholder="Buscar correo o perfil" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ maxHeight: '65dvh', overflowY: 'auto', marginTop: 10 }}>
        {visible.map(a => {
          const badge = STATUS_LABEL[a.status]
          const sub = a.assigned_item_id ? subsByItemId.get(a.assigned_item_id) : undefined
          const left = sub?.item.valid_until ? daysLeft(sub.item.valid_until) : null
          return (
            <div key={a.id} style={{ background: '#222', padding: 10, margin: '6px 0', borderRadius: 8, opacity: a.status === 'disabled' ? 0.65 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{a.platform} · {a.stream_type === 'full' ? STREAM_TYPE_LABEL.full : a.profile_name}</strong>
                <span style={{ fontSize: 12, color: badge.color }}>● {badge.text}</span>
              </div>

              {editing === a.id ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <label>Correo<input autoComplete="off" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} /></label>
                  <label>Contraseña<input autoComplete="off" value={draft.password} onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} /></label>
                  {a.stream_type === 'profile' && <label>Perfil<input value={draft.profile_name} onChange={e => setDraft(d => ({ ...d, profile_name: e.target.value }))} /></label>}
                  <label>PIN<input autoComplete="off" value={draft.pin} onChange={e => setDraft(d => ({ ...d, pin: e.target.value }))} /></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="button small" disabled={busy === a.id} onClick={() => { void saveEdit(a) }}>Guardar</button>
                    <button type="button" className="button small secondary" onClick={() => setEditing(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13 }}>📩 {a.email} · 🔑 {a.password}{a.pin ? ` · 🚨 ${a.pin}` : ''}</p>
                  {a.status === 'assigned' && (
                    <p style={{ fontSize: 13, opacity: 0.85 }}>
                      {sub ? <>Cliente: {sub.order.profiles?.full_name || 'Cliente'} · vence {fmtDate(sub.item.valid_until)}{left !== null && left <= 5 ? ` (${left < 0 ? 'vencida' : `faltan ${left} d`})` : ''}</> : 'Asignada a una venta'}
                    </p>
                  )}
                  {releasing !== a.id && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {a.status !== 'assigned' && <button type="button" className="button small secondary" onClick={() => startEdit(a)}>Editar</button>}
                      {a.status !== 'assigned' && <button type="button" className="button small secondary" disabled={busy === a.id} onClick={() => toggle(a)}>{a.status === 'disabled' ? 'Activar' : 'Desactivar'}</button>}
                      {a.status !== 'assigned' && <button type="button" className="button small secondary" disabled={busy === a.id} onClick={() => remove(a)}>Eliminar</button>}
                      {a.status === 'assigned' && sub && <button type="button" className="button small" onClick={() => setReleasing(a.id)}>Quitar acceso</button>}
                    </div>
                  )}
                  {a.status === 'assigned' && <p style={{ fontSize: 11, opacity: 0.6 }}>Para corregir los datos de una cuenta vendida usa Streaming → Editar cuenta.</p>}
                </>
              )}
              {releasing === a.id && sub && (
                <ReleaseAccessForm sub={sub} data={data} onDone={() => setReleasing(null)} onCancel={() => setReleasing(null)} />
              )}
            </div>
          )
        })}
        {list.length === 0 && <p>Todavía no hay cuentas. Agrégalas arriba.</p>}
        {list.length > 0 && visible.length === 0 && <p>No hay cuentas con esos filtros.</p>}
      </div>
    </div>
  )
}
