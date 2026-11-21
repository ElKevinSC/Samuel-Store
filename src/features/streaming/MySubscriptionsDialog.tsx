import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PaymentDraft } from '@/features/checkout/usePaymentDraft'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import { StreamingConditions } from './StreamingConditions'
import { SubscriptionCard } from './SubscriptionCard'
import { subState, type SubState } from './streaming'
import { useMySubscriptions } from './useMySubscriptions'

type Filter = 'all' | SubState
const FILTERS: [Filter, string][] = [['all', 'Todas'], ['expiring', 'Por vencer'], ['expired', 'Vencidas'], ['revoked', 'Finalizadas']]

export function MySubscriptionsDialog({ pay }: { pay: PaymentDraft }) {
  const { isReseller, setRenewItem, setMessage, setModal, refreshMyOrders } = useStore()
  const { mySubs, pendingRenewals, counts } = useMySubscriptions()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return mySubs.filter(it => {
      if (filter !== 'all' && subState(it) !== filter) return false
      if (!term) return true
      return [it.game_name, it.delivery_profile, it.delivery_email, it.end_customer_name, it.end_customer_phone]
        .some(v => (v ?? '').toLowerCase().includes(term))
    })
  }, [mySubs, filter, search])

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

  const countOf = (f: Filter) => (f === 'all' ? mySubs.length : counts[f])

  return (
    <>
      <DialogHeader>
        <DialogTitle>Mis suscripciones</DialogTitle>
        <DialogDescription>
          {isReseller ? 'Tus cuentas de streaming. Copia los datos o envíalos por WhatsApp a tu cliente.' : 'Tus perfiles de streaming y cuánto tiempo les queda.'}
        </DialogDescription>
      </DialogHeader>

      {mySubs.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FILTERS.filter(([f]) => f === 'all' || countOf(f) > 0).map(([f, label]) => (
              <button key={f} type="button" className={filter === f ? 'button small' : 'button small secondary'} onClick={() => setFilter(f)}>
                {label} ({countOf(f)})
              </button>
            ))}
            <button type="button" className="button small secondary" aria-label="Actualizar" onClick={() => { void refreshMyOrders() }}><RefreshCw size={14} /></button>
          </div>
          {mySubs.length > 4 && (
            <input placeholder="Buscar por plataforma, perfil o cliente" value={search} onChange={e => setSearch(e.target.value)} />
          )}
        </div>
      )}

      <div style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
        {visible.map(it => (
          <SubscriptionCard key={it.id} it={it} waitingRenewal={pendingRenewals.has(it.id)} canLabel={isReseller} onRenew={startRenew} />
        ))}
        {mySubs.length === 0 && <p>Aún no tienes suscripciones activas.</p>}
        {mySubs.length > 0 && visible.length === 0 && <p>No hay suscripciones con ese filtro.</p>}
        <div style={{ marginTop: 12 }}><StreamingConditions /></div>
      </div>
    </>
  )
}
