// Renovar varias cuentas con un solo depósito y un solo comprobante.
// Solo aparecen las que vencen en 1 a 5 días y no tienen otra renovación en revisión.
import { useMemo, useState } from 'react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { money } from '@/data/catalog'
import { BankAccountsBox, CheckboxRow, ReceiptPicker, StickySubmit } from '@/features/checkout/PaymentFields'
import type { PaymentDraft } from '@/features/checkout/usePaymentDraft'
import { daysLeft, fmtDate } from '@/lib/dates'
import { receiptProblem, removeReceipt, uploadReceipt } from '@/lib/receipts'
import { EXPIRY_WINDOW_DAYS } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Item, Product } from '@/store/types'
import { StreamingConditions } from './StreamingConditions'
import { useMySubscriptions } from './useMySubscriptions'

type Renewable = { item: Item; product: Product; price: number; left: number }

/** Cuentas que hoy se pueden renovar (mismas reglas que la base de datos). */
export function useRenewable(): Renewable[] {
  const { products, unitPrice } = useStore()
  const { mySubs, pendingRenewals } = useMySubscriptions()
  return useMemo(() => {
    const list: Renewable[] = []
    for (const it of mySubs) {
      if (it.access_revoked_at || !it.valid_until || pendingRenewals.has(it.id)) continue
      const left = daysLeft(it.valid_until)
      if (left < 1 || left > EXPIRY_WINDOW_DAYS) continue
      const product = products.find(p => p.id === it.product_id)
      if (!product) continue
      list.push({ item: it, product, price: unitPrice(product), left })
    }
    return list.sort((a, b) => a.left - b.left || a.item.game_name.localeCompare(b.item.game_name, 'es'))
  }, [mySubs, pendingRenewals, products, unitPrice])
}

export function RenewManyDialog({ pay }: { pay: PaymentDraft }) {
  const { supabase, user, isReseller, banks, loading, setLoading, message, setMessage, setModal, showToast, refreshMyOrders } = useStore()
  const renewable = useRenewable()
  // Por defecto van todas marcadas; el usuario quita las que no quiere renovar.
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set())
  const chosen = renewable.filter(r => !unchecked.has(r.item.id))
  const total = chosen.reduce((t, r) => t + r.price, 0)

  const toggle = (id: string) => setUnchecked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const setAll = (on: boolean) => setUnchecked(on ? new Set() : new Set(renewable.map(r => r.item.id)))

  async function submit() {
    if (!user) return
    if (chosen.length === 0) { setMessage('Elige al menos una cuenta para renovar.'); return }
    const { reference, depositDate, receipt } = pay
    if (!reference.trim() || !depositDate || !receipt) { setMessage('Completa todos los campos y adjunta el comprobante.'); return }
    if (!pay.acceptTerms || !pay.acceptService) { setMessage('Debes aceptar los términos y las condiciones del servicio.'); return }
    const problem = receiptProblem(receipt)
    if (problem) { setMessage(problem); return }
    if (!window.confirm(`¿Enviar la renovación de ${chosen.length} cuenta${chosen.length === 1 ? '' : 's'} por ${money(total)}?`)) return

    setLoading(true)
    setMessage('Subiendo comprobante...')
    const uploaded = await uploadReceipt(supabase, user.id, receipt)
    if ('error' in uploaded) {
      setLoading(false)
      setMessage(`Error al subir boleta: ${uploaded.error}`)
      return
    }
    const { error } = await supabase.rpc('create_renewals', {
      p_item_ids: chosen.map(r => r.item.id),
      p_reference_nc: reference.trim(),
      p_deposit_date: depositDate,
      p_receipt_path: uploaded.path,
      p_amount: total,
    })
    if (error) {
      await removeReceipt(supabase, uploaded.path)
      setLoading(false)
      setMessage(`No se pudo enviar la renovación: ${error.message}`)
      return
    }
    setLoading(false)
    pay.setReference('')
    pay.setDepositDate('')
    pay.setReceipt(null)
    pay.setAcceptTerms(false)
    pay.setAcceptService(false)
    setMessage('')
    setModal('my_subs')
    showToast(`Renovación de ${chosen.length} cuenta${chosen.length === 1 ? '' : 's'} enviada. Te avisaremos cuando se apruebe.`)
    await refreshMyOrders(user.id)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Renovar varias cuentas</DialogTitle>
        <DialogDescription>Elige las cuentas, haz un solo depósito por el total y adjunta un solo comprobante.</DialogDescription>
      </DialogHeader>
      <div className="auth-form">
        {renewable.length === 0 ? (
          <p>No tienes cuentas para renovar en este momento. Se pueden renovar de {EXPIRY_WINDOW_DAYS} a 1 días antes de que venzan.</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong>{chosen.length} de {renewable.length} seleccionada{renewable.length === 1 ? '' : 's'}</strong>
              <button type="button" className="button small secondary" onClick={() => setAll(chosen.length !== renewable.length)}>
                {chosen.length === renewable.length ? 'Quitar todas' : 'Marcar todas'}
              </button>
            </div>
            <div role="group" aria-label="Cuentas a renovar" style={{ display: 'grid', gap: 6, maxHeight: '38dvh', overflowY: 'auto' }}>
              {renewable.map(({ item: it, price, left }) => {
                const on = !unchecked.has(it.id)
                return (
                  <label key={it.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#101e2e', border: `1px solid ${on ? '#00a3ff' : '#194c6c'}`, borderRadius: 10, padding: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(it.id)} style={{ width: 20, height: 20, flex: '0 0 auto' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>{it.game_name} · {it.delivery_profile || '—'}</strong>
                      {isReseller && it.end_customer_name && <span style={{ display: 'block', fontSize: 13, opacity: 0.85 }}>Para: {it.end_customer_name}</span>}
                      <span style={{ display: 'block', fontSize: 13, color: '#ffcc00' }}>Vence {fmtDate(it.valid_until)} · {left === 1 ? 'mañana' : `en ${left} días`}</span>
                    </span>
                    <span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{money(price)}</span>
                  </label>
                )
              })}
            </div>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Cada cuenta suma los días de su plan a partir de su fecha de vencimiento actual.</p>
            <p style={{ fontSize: 18 }}><strong>Total a depositar: {money(total)}</strong></p>
            <BankAccountsBox banks={banks} />
            <label>Referencia NC<input value={pay.reference} onChange={e => pay.setReference(e.target.value)} /></label>
            <label>Fecha del depósito<input type="date" value={pay.depositDate} onChange={e => pay.setDepositDate(e.target.value)} /></label>
            <ReceiptPicker receipt={pay.receipt} onChange={pay.setReceipt} />
            <StreamingConditions />
            <CheckboxRow checked={pay.acceptService} onChange={pay.setAcceptService}>Leí y acepto las condiciones del servicio</CheckboxRow>
            <CheckboxRow checked={pay.acceptTerms} onChange={pay.setAcceptTerms}>Acepto los términos y condiciones</CheckboxRow>
            <StickySubmit message={message} loading={loading}
              label={chosen.length ? `Enviar renovación (${chosen.length}) · ${money(total)}` : 'Elige al menos una cuenta'}
              onClick={() => { void submit() }} />
          </>
        )}
        <button type="button" className="button secondary small" onClick={() => { setMessage(''); setModal('my_subs') }}>← Volver a Mis suscripciones</button>
      </div>
    </>
  )
}
