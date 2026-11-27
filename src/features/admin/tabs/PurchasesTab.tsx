// Suscripciones de streaming de todos los clientes y revendedores, por plataforma.
import { PurchasesBrowser } from '@/features/purchases/PurchasesBrowser'
import { useStore } from '@/store/StoreProvider'
import { AdminSubDetail } from '../AdminSubDetail'
import type { DeliveryDrafts } from '../useDeliveryDrafts'

export function PurchasesTab({ drafts }: { drafts: DeliveryDrafts }) {
  const { orders } = useStore()
  return (
    <div className="admin-form">
      <h3>🎬 Suscripciones de clientes</h3>
      <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        Todas las cuentas de streaming que han comprado tus clientes y revendedores. Busca por nombre del cliente, correo, perfil o PIN.
      </p>
      <PurchasesBrowser
        orders={orders}
        mode="admin"
        renderStreamDetail={({ item, order }) => <AdminSubDetail item={item} order={order} drafts={drafts} showAccess compact />}
      />
    </div>
  )
}
