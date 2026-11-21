import { money } from '@/data/catalog'
import { useStore } from '@/store/StoreProvider'
import type { AdminData } from '../useAdminData'

export function ClientsTab({ data }: { data: AdminData }) {
  const { setHistoryUser, setModal } = useStore()
  const { usersWithOrders } = data
  return (
    <div className="admin-form" style={{ marginTop: 20 }}>
      <h3>Pedidos por usuario</h3>
      {usersWithOrders.map(u => (
        <div key={u.id} style={{ backgroundColor: '#222', padding: 10, margin: '5px 0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <strong>{u.name}</strong>
            <p style={{ fontSize: 13 }}>{u.count} pedidos | Completado: {money(u.total)}</p>
          </div>
          <button className="button small" onClick={() => { setHistoryUser(u.id); setModal('user_orders') }}>Ver</button>
        </div>
      ))}
      {usersWithOrders.length === 0 && <p>Aún no hay pedidos.</p>}
    </div>
  )
}
