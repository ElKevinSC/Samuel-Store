import { money } from '@/data/catalog'
import { RESELLER_MIN } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Profile } from '@/store/types'
import type { AdminData } from '../useAdminData'

export function ResellersTab({ data }: { data: AdminData }) {
  const { supabase, isAdmin, setMessage, refreshAdmin, setHistoryUser, setModal } = useStore()
  const { resellers, pendingResellers, salesStats } = data

  async function approveReseller(id: string, status: 'approved' | 'rejected') {
    if (!isAdmin) return
    const { error } = await supabase.from('profiles').update({
      role: status === 'approved' ? 'reseller' : 'customer',
      application_status: status,
    }).eq('id', id)
    if (error) setMessage(`No se pudo actualizar la solicitud: ${error.message}`)
    else await refreshAdmin()
  }

  async function removeReseller(r: Profile) {
    if (!window.confirm(`¿Quitar a ${r.full_name || 'este usuario'} del programa de revendedores? Volverá a precios de cliente.`)) return
    await approveReseller(r.id, 'rejected')
  }

  return (
    <>
      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Revendedores (mínimo {money(RESELLER_MIN)} al mes)</h3>
        {resellers.map(r => {
          const cur = salesStats.byUserMonth.get(r.id) ?? { total: 0, count: 0 }
          const prev = salesStats.byUserPrev.get(r.id)?.total ?? 0
          const ok = cur.total >= RESELLER_MIN
          const pct = Math.min(100, Math.round((cur.total / RESELLER_MIN) * 100))
          return (
            <div key={r.id} style={{ background: '#222', padding: 10, margin: '6px 0', borderRadius: 8 }}>
              <strong>{r.full_name || 'Revendedor'}</strong>
              <p style={{ fontSize: 13 }}>Este mes: {money(cur.total)} ({cur.count} pedidos) — {ok ? 'Cumple' : `Faltan ${money(RESELLER_MIN - cur.total)}`}</p>
              <p style={{ fontSize: 13 }}>Mes pasado: {money(prev)} {prev >= RESELLER_MIN ? '(cumplió)' : '(no cumplió)'}</p>
              <div style={{ background: '#111', borderRadius: 999, height: 8, overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: ok ? '#25d366' : '#f0a500' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="button secondary small" onClick={() => { setHistoryUser(r.id); setModal('user_orders') }}>Ver pedidos</button>
                <button className="button small" onClick={() => { void removeReseller(r) }}>Quitar del programa</button>
              </div>
            </div>
          )
        })}
        {resellers.length === 0 && <p>Aún no tienes revendedores.</p>}
      </div>

      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Solicitudes de revendedor pendientes</h3>
        <button type="button" className="button secondary small" onClick={() => { void refreshAdmin() }} style={{ marginBottom: 10 }}>↻ Actualizar solicitudes</button>
        {pendingResellers.map(p => (
          <div key={p.id} className="admin-product-row" style={{ backgroundColor: '#222', padding: 10, margin: '5px 0' }}>
            <span><strong>{p.full_name || 'Usuario'}</strong> quiere ser revendedor.<br />Edad: {p.age ?? '—'} | WhatsApp: {p.whatsapp ? <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{p.whatsapp} (Contactar)</a> : '—'} | Ventas estimadas: {p.expected_sales != null ? money(Number(p.expected_sales)) : '—'}</span>
            <div>
              <button className="button small" onClick={() => { void approveReseller(p.id, 'approved') }}>Aprobar</button>
              <button className="button small" style={{ marginLeft: 5 }} onClick={() => { void approveReseller(p.id, 'rejected') }}>Rechazar</button>
            </div>
          </div>
        ))}
        {pendingResellers.length === 0 && <p>No hay solicitudes pendientes.</p>}
      </div>
    </>
  )
}
