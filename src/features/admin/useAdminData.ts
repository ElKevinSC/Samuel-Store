// Cálculos del panel de administración a partir de los datos del store.
import { useMemo } from 'react'
import { daysLeft, gtDate, prevMonthKey } from '@/lib/dates'
import { EXPIRY_WINDOW_DAYS, OPEN_ORDER_STATUSES } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item, Product, Subscription } from '@/store/types'
import { isDeliveredSub } from '@/features/streaming/streaming'

export function useAdminData() {
  const { orders, profiles, products, allProducts } = useStore()

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders])
  const pendingResellers = useMemo(() => profiles.filter(p => p.application_status === 'pending'), [profiles])
  const resellers = useMemo(() => profiles.filter(p => p.role === 'reseller'), [profiles])

  const salesStats = useMemo(() => {
    const nowMonth = gtDate(new Date().toISOString()).slice(0, 7)
    const prevMonth = prevMonthKey(nowMonth)
    let total = 0
    let month = 0
    let pending = 0
    let completedCount = 0
    const byMonth = new Map<string, number>()
    const byUserMonth = new Map<string, { total: number; count: number }>()
    const byUserPrev = new Map<string, { total: number; count: number }>()
    for (const o of orders) {
      const amt = Number(o.amount) || 0
      if (o.status === 'completed') {
        const m = gtDate(o.completed_at || o.created_at).slice(0, 7)
        total += amt
        completedCount += 1
        byMonth.set(m, (byMonth.get(m) ?? 0) + amt)
        const target = m === nowMonth ? byUserMonth : m === prevMonth ? byUserPrev : null
        if (m === nowMonth) month += amt
        if (target) {
          const u = target.get(o.user_id) ?? { total: 0, count: 0 }
          u.total += amt
          u.count += 1
          target.set(o.user_id, u)
        }
      } else if (o.status === 'pending') {
        pending += amt
      }
    }
    const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
    return { total, month, pending, completedCount, months, byUserMonth, byUserPrev }
  }, [orders])

  const usersWithOrders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; total: number }>()
    for (const o of orders) {
      const cur = map.get(o.user_id) ?? { id: o.user_id, name: o.profiles?.full_name || 'Sin nombre', count: 0, total: 0 }
      cur.count += 1
      if (o.status === 'completed') cur.total += Number(o.amount)
      map.set(o.user_id, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [orders])

  const itemsById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const o of orders) for (const it of o.order_items ?? []) m.set(it.id, it)
    return m
  }, [orders])

  /** Todas las suscripciones entregadas (incluye finalizadas), por vencimiento. */
  const allSubs = useMemo(() => {
    const list: Subscription[] = []
    for (const o of orders) {
      if (o.status !== 'completed') continue
      for (const it of o.order_items ?? []) if (isDeliveredSub(it)) list.push({ item: it, order: o })
    }
    return list.sort((a, b) => String(a.item.valid_until).localeCompare(String(b.item.valid_until)))
  }, [orders])

  const subsByItemId = useMemo(() => new Map(allSubs.map(s => [s.item.id, s])), [allSubs])
  const adminSubs = useMemo(() => allSubs.filter(s => !s.item.access_revoked_at), [allSubs])
  const revokedCount = allSubs.length - adminSubs.length

  /** Las que vencen en 5 días o menos (y las ya vencidas sin liberar). */
  const expiringSubs = useMemo(
    () => adminSubs.filter(s => daysLeft(s.item.valid_until ?? '') <= EXPIRY_WINDOW_DAYS),
    [adminSubs],
  )

  /** Suscripciones con una renovación esperando aprobación. */
  const pendingRenewalOf = useMemo(() => {
    const set = new Set<string>()
    for (const o of orders) {
      if (!OPEN_ORDER_STATUSES.includes(o.status)) continue
      for (const it of o.order_items ?? []) if (it.renewal_of) set.add(it.renewal_of)
    }
    return set
  }, [orders])

  const productsById = useMemo(() => new Map<string, Product>(allProducts.map(p => [p.id, p])), [allProducts])

  const contactRows = useMemo(() => {
    const m = new Map<string, { key: string; category: string; game: string; contact: string }>()
    for (const pr of products) {
      const game = pr.game_name || 'Otros'
      const key = `${pr.category}|${game}`
      if (!m.has(key)) m.set(key, { key, category: pr.category, game, contact: pr.contact_type })
    }
    return Array.from(m.values())
  }, [products])

  const productGroups = useMemo(() => {
    const m = new Map<string, { key: string; category: string; game: string; items: Product[] }>()
    for (const pr of allProducts) {
      const game = pr.game_name || 'Otros'
      const key = `${pr.category}|${game}`
      const g = m.get(key) ?? { key, category: pr.category, game, items: [] }
      g.items.push(pr)
      m.set(key, g)
    }
    return Array.from(m.values()).sort((a, b) => a.category.localeCompare(b.category) || a.game.localeCompare(b.game))
  }, [allProducts])

  return {
    pendingOrders, pendingResellers, resellers, salesStats, usersWithOrders, itemsById,
    allSubs, subsByItemId, adminSubs, revokedCount, expiringSubs, pendingRenewalOf, productsById,
    contactRows, productGroups,
  }
}

export type AdminData = ReturnType<typeof useAdminData>
