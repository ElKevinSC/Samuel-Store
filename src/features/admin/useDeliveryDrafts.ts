import { useState } from 'react'
import { baseDel } from '@/features/streaming/streaming'
import type { Delivery, Item } from '@/store/types'

/** Datos de cuenta que el admin escribe a mano antes de guardarlos. */
export function useDeliveryDrafts() {
  const [delivery, setDelivery] = useState<Record<string, Delivery>>({})
  const [editingDeliveredId, setEditingDeliveredId] = useState<string | null>(null)
  const [savingDeliveredId, setSavingDeliveredId] = useState<string | null>(null)

  const getDel = (it: Item): Delivery => delivery[it.id] ?? baseDel(it)

  function setDel(it: Item, patch: Partial<Delivery>) {
    setDelivery(cur => ({ ...cur, [it.id]: { ...(cur[it.id] ?? baseDel(it)), ...patch } }))
  }

  function startEditingDelivered(it: Item) {
    setDelivery(cur => ({ ...cur, [it.id]: baseDel(it) }))
    setEditingDeliveredId(it.id)
  }

  function cancelEditingDelivered(id: string) {
    setEditingDeliveredId(null)
    setDelivery(cur => {
      const next = { ...cur }
      delete next[id]
      return next
    })
  }

  return { getDel, setDel, editingDeliveredId, startEditingDelivered, cancelEditingDelivered, savingDeliveredId, setSavingDeliveredId }
}

export type DeliveryDrafts = ReturnType<typeof useDeliveryDrafts>
