// "Mis suscripciones": las cuentas de streaming del usuario, por plataforma.
import { RefreshCw } from 'lucide-react'
import { money } from '@/data/catalog'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PaymentDraft } from '@/features/checkout/usePaymentDraft'
import { PurchasesBrowser } from '@/features/purchases/PurchasesBrowser'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import { StreamingConditions } from './StreamingConditions'
import { SubscriptionCard } from './SubscriptionCard'
import { useRenewable } from './RenewManyDialog'
import { useMySubscriptions } from './useMySubscriptions'

export function MySubscriptionsDialog({ pay }: { pay: PaymentDraft }) {
  const { isReseller, myOrders, setRenewItem, setMessage, setModal, refreshMyOrders } = useStore()
  const { pendingRenewals } = useMySubscriptions()
  const renewable = useRenewable()
  const renewableTotal = renewable.reduce((t, r) => t + r.price, 0)

  function startRenew(it: Item) {
    setRenewItem(it)
    pay.setReference('')
    pay.setDepositDate('')
    pay.setReceipt(null)
    pay.setAcceptTerms(false)
    pay.setAcceptService(false)
    setMessage('')
    setModal('renew')
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Mis suscripciones</DialogTitle>
        <DialogDescription>
          {isReseller ? 'Tus cuentas de streaming. Toca una cuenta para copiar los datos o enviarlos por WhatsApp a tu cliente.' : 'Tus cuentas de streaming. Toca una cuenta para ver sus datos.'}
        </DialogDescription>
      </DialogHeader>

      <div style={{ maxHeight: '68dvh', overflowY: 'auto', display: 'grid', gap: 12 }}>
        {renewable.length >= 2 && (
          <button type="button" className="button small" onClick={() => { setMessage(''); setModal('renew_many') }}>
            <RefreshCw size={14} /> Renovar varias a la vez ({renewable.length}) · {money(renewableTotal)}
          </button>
        )}
        <PurchasesBrowser
          orders={myOrders}
          mode="mine"
          renderStreamDetail={({ item }) => (
            <SubscriptionCard it={item} compact waitingRenewal={pendingRenewals.has(item.id)} canLabel={isReseller} onRenew={startRenew} />
          )}
        />
        <button type="button" className="button secondary small" onClick={() => { void refreshMyOrders() }}><RefreshCw size={14} /> Actualizar</button>
        <StreamingConditions />
      </div>
    </>
  )
}
