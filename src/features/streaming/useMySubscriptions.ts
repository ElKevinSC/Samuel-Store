import { useMemo } from 'react'
import { OPEN_ORDER_STATUSES } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item } from '@/store/types'
import { isDeliveredSub, subState } from './streaming'

/** Suscripciones del usuario actual y renovaciones que tiene en revisión. */
export function useMySubscriptions() {
  const { myOrders } = useStore()

  const mySubs = useMemo(() => {
    const list: Item[] = []
    for (const o of myOrders) {
      if (o.status !== 'completed') continue
      for (const it of o.order_items ?? []) if (isDeliveredSub(it)) list.push(it)
    }
    // Las finalizadas van al final; el resto, por fecha de vencimiento.
    return list.sort((a, b) =>
      Number(!!a.access_revoked_at) - Number(!!b.access_revoked_at) || String(a.valid_until).localeCompare(String(b.valid_until)))
  }, [myOrders])

  const pendingRenewals = useMemo(() => {
    const set = new Set<string>()
    for (const o of myOrders) {
      if (!OPEN_ORDER_STATUSES.includes(o.status)) continue
      for (const it of o.order_items ?? []) if (it.renewal_of) set.add(it.renewal_of)
    }
    return set
  }, [myOrders])

  const counts = useMemo(() => {
    const c = { active: 0, expiring: 0, expired: 0, revoked: 0 }
    for (const it of mySubs) c[subState(it)] += 1
    return c
  }, [mySubs])

  return { mySubs, pendingRenewals, counts }
}
