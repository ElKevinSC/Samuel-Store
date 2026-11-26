// Suscripciones de streaming entregadas: recordar, reenviar y corregir datos.
import { ExpiringAccounts } from '@/features/inventory/ExpiringAccounts'
import { AdminSubDetail } from '../AdminSubDetail'
import type { AdminData } from '../useAdminData'
import type { DeliveryDrafts } from '../useDeliveryDrafts'

export function StreamingSubsTab({ data, drafts }: { data: AdminData; drafts: DeliveryDrafts }) {
  const { adminSubs, revokedCount } = data

  return (
    <>
      <ExpiringAccounts data={data} />

      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Suscripciones de streaming</h3>
        <div style={{ maxHeight: '50dvh', overflowY: 'auto' }}>
          {adminSubs.map(({ item, order }) => (
            <AdminSubDetail key={item.id} item={item} order={order} drafts={drafts} />
          ))}
          {adminSubs.length === 0 && <p>Aún no hay suscripciones entregadas.</p>}
        </div>
        {revokedCount > 0 && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>{revokedCount} suscripción{revokedCount === 1 ? '' : 'es'} finalizada{revokedCount === 1 ? '' : 's'} (acceso retirado) no se muestra{revokedCount === 1 ? '' : 'n'}.</p>}
      </div>
    </>
  )
}
