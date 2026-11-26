import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PaymentDraft } from '@/features/checkout/usePaymentDraft'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import { StreamingConditions } from './StreamingConditions'
import { SubscriptionCard } from './SubscriptionCard'
import { platformKey, subState, type SubState } from './streaming'
import { useMySubscriptions } from './useMySubscriptions'

type Filter = 'all' | SubState
const FILTERS: [Filter, string][] = [['all', 'Todas'], ['expiring', 'Por vencer'], ['expired', 'Vencidas'], ['revoked', 'Finalizadas']]
const ALL_PLATFORMS = ''

export function MySubscriptionsDialog({ pay }: { pay: PaymentDraft }) {
  const { isReseller, setRenewItem, setMessage, setModal, refreshMyOrders } = useStore()
  const { mySubs, pendingRenewals } = useMySubscriptions()
  const [filter, setFilter] = useState<Filter>('all')
  const [platform, setPlatform] = useState(ALL_PLATFORMS)
  const [search, setSearch] = useState('')

  // Plataformas que tiene el usuario (Netflix, HBO MAX, Disney…), con cuántas cuentas de cada una.
  const platforms = useMemo(() => {
    const m = new Map<string, { key: string; name: string; count: number }>()
    for (const it of mySubs) {
      const key = platformKey(it.game_name || '')
      const row = m.get(key) ?? { key, name: (it.game_name || 'Otra').trim(), count: 0 }
      row.count += 1
      m.set(key, row)
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [mySubs])

  // Si la plataforma elegida ya no existe (p. ej. tras actualizar), se vuelve a "Todas".
  const selectedPlatform = platforms.some(p => p.key === platform) ? platform : ALL_PLATFORMS
  const ofPlatform = useMemo(
    () => (selectedPlatform === ALL_PLATFORMS ? mySubs : mySubs.filter(it => platformKey(it.game_name || '') === selectedPlatform)),
    [mySubs, selectedPlatform],
  )
  const stateCounts = useMemo(() => {
    const c: Record<SubState, number> = { active: 0, expiring: 0, expired: 0, revoked: 0 }
    for (const it of ofPlatform) c[subState(it)] += 1
    return c
  }, [ofPlatform])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return ofPlatform.filter(it => {
      if (filter !== 'all' && subState(it) !== filter) return false
      if (!term) return true
      return [it.game_name, it.delivery_profile, it.delivery_email, it.end_customer_name, it.end_customer_phone]
        .some(v => (v ?? '').toLowerCase().includes(term))
    })
  }, [ofPlatform, filter, search])

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

  const countOf = (f: Filter) => (f === 'all' ? ofPlatform.length : stateCounts[f])

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
          {platforms.length > 1 && (
            <div role="group" aria-label="Filtrar por plataforma" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <button type="button" aria-pressed={selectedPlatform === ALL_PLATFORMS}
                className={selectedPlatform === ALL_PLATFORMS ? 'button small' : 'button small secondary'}
                style={{ flex: '0 0 auto' }} onClick={() => setPlatform(ALL_PLATFORMS)}>
                Todas las plataformas ({mySubs.length})
              </button>
              {platforms.map(p => (
                <button key={p.key} type="button" aria-pressed={selectedPlatform === p.key}
                  className={selectedPlatform === p.key ? 'button small' : 'button small secondary'}
                  style={{ flex: '0 0 auto' }} onClick={() => { setPlatform(p.key); setFilter('all') }}>
                  {p.name} ({p.count})
                </button>
              ))}
            </div>
          )}
          <div role="group" aria-label="Filtrar por estado" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FILTERS.filter(([f]) => f === 'all' || countOf(f) > 0).map(([f, label]) => (
              <button key={f} type="button" className={filter === f ? 'button small' : 'button small secondary'} onClick={() => setFilter(f)}>
                {label} ({countOf(f)})
              </button>
            ))}
            <button type="button" className="button small secondary" aria-label="Actualizar" onClick={() => { void refreshMyOrders() }}><RefreshCw size={14} /></button>
          </div>
          {mySubs.length > 4 && (
            <input placeholder="Buscar por perfil, correo o cliente" value={search} onChange={e => setSearch(e.target.value)} />
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
