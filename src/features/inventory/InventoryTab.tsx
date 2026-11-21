import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AdminData } from '@/features/admin/useAdminData'
import { STREAM_TYPE_LABEL, stockKey, streamTypeOf } from '@/features/streaming/streaming'
import { useStore } from '@/store/StoreProvider'
import { AddAccountsForm } from './AddAccountsForm'
import { InventoryList } from './InventoryList'
import { summarizeInventory } from './inventory'

export function InventoryTab({ data }: { data: AdminData }) {
  const { inventory, products, refreshAdmin } = useStore()
  const summary = useMemo(() => summarizeInventory(inventory ?? []), [inventory])

  // Productos a la venta cuya plataforma no tiene ninguna cuenta disponible.
  const soldOut = useMemo(() => {
    const available = new Map(summary.map(s => [s.key, s.available]))
    const seen = new Set<string>()
    const out: string[] = []
    for (const p of products) {
      if (p.category !== 'Streaming') continue
      const type = streamTypeOf(p)
      const key = stockKey(p.game_name || 'Otros', type)
      if (seen.has(key)) continue
      seen.add(key)
      if (!available.get(key)) out.push(`${p.game_name || 'Otros'} · ${STREAM_TYPE_LABEL[type]}`)
    }
    return out
  }, [products, summary])

  if (inventory === null) {
    return (
      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Inventario de streaming</h3>
        <p>El inventario todavía no está activado. En Supabase abre <strong>SQL Editor</strong>, pega y ejecuta el archivo <code>Supabase/Migrations/202611190001_streaming_inventory.sql</code>, y luego toca Actualizar.</p>
        <button className="button secondary small" onClick={() => { void refreshAdmin() }}><RefreshCw size={14} /> Actualizar</button>
      </div>
    )
  }

  return (
    <>
      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Existencias</h3>
        {summary.length === 0 && <p>Aún no hay cuentas en el inventario.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {summary.map(s => (
            <div key={s.key} style={{ background: '#101e2e', border: `1px solid ${s.available === 0 ? '#f06675' : s.available <= 3 ? '#ffcc00' : '#194c6c'}`, borderRadius: 10, padding: 10 }}>
              <strong>{s.platform}</strong> <small>({STREAM_TYPE_LABEL[s.type]})</small>
              <p style={{ fontSize: 22, color: s.available === 0 ? '#f06675' : '#31d6ff' }}>{s.available} <small style={{ fontSize: 12 }}>disponibles</small></p>
              <p style={{ fontSize: 12, opacity: 0.8 }}>{s.assigned} vendidas{s.disabled ? ` · ${s.disabled} desactivadas` : ''}</p>
            </div>
          ))}
        </div>
        {soldOut.length > 0 && (
          <p style={{ fontSize: 13, color: '#ffcc00', marginTop: 10 }}>
            Sin cuentas disponibles: {soldOut.join(', ')}. Los pedidos de estas plataformas se entregan a mano hasta que agregues cuentas.
          </p>
        )}
        <button className="button secondary small" style={{ marginTop: 10 }} onClick={() => { void refreshAdmin() }}><RefreshCw size={14} /> Actualizar</button>
      </div>
      <AddAccountsForm />
      <InventoryList data={data} />
    </>
  )
}
