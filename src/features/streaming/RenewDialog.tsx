import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { money } from '@/data/catalog'
import { BankAccountsBox, CheckboxRow, ReceiptPicker, StickySubmit } from '@/features/checkout/PaymentFields'
import type { PaymentDraft } from '@/features/checkout/usePaymentDraft'
import { fmtDate } from '@/lib/dates'
import { receiptProblem, removeReceipt, uploadReceipt } from '@/lib/receipts'
import { useStore } from '@/store/StoreProvider'
import { StreamingConditions } from './StreamingConditions'

export function RenewDialog({ pay }: { pay: PaymentDraft }) {
  const { supabase, user, renewItem, setRenewItem, products, unitPrice, banks, loading, setLoading, message, setMessage, setModal, showToast, refreshMyOrders } = useStore()
  if (!renewItem) return null
  const renewProduct = products.find(pr => pr.id === renewItem.product_id) ?? null
  const renewPrice = renewProduct ? unitPrice(renewProduct) : 0

  async function submitRenewal() {
    if (!user || !renewItem || !renewProduct) {
      setMessage('Este servicio ya no está disponible para renovar.')
      return
    }
    const { reference, depositDate, receipt } = pay
    if (!reference.trim() || !depositDate || !receipt) {
      setMessage('Completa todos los campos y adjunta el comprobante.')
      return
    }
    if (!pay.acceptTerms || !pay.acceptService) {
      setMessage('Debes aceptar los términos y las condiciones del servicio.')
      return
    }
    const problem = receiptProblem(receipt)
    if (problem) {
      setMessage(problem)
      return
    }
    setLoading(true)
    setMessage('Subiendo comprobante...')
    const uploaded = await uploadReceipt(supabase, user.id, receipt)
    if ('error' in uploaded) {
      setLoading(false)
      setMessage(`Error al subir boleta: ${uploaded.error}`)
      return
    }
    const { error } = await supabase.rpc('create_renewal', {
      p_item_id: renewItem.id,
      p_reference_nc: reference.trim(),
      p_deposit_date: depositDate,
      p_receipt_path: uploaded.path,
      p_amount: renewPrice,
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
    setRenewItem(null)
    setModal('my_subs')
    showToast('Renovación enviada. Te avisaremos cuando se apruebe.')
    await refreshMyOrders(user.id)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Renovar {renewItem.game_name} - {renewItem.delivery_profile}</DialogTitle>
        <DialogDescription>Deposita el monto y adjunta tu comprobante.</DialogDescription>
      </DialogHeader>
      <div className="auth-form">
        <p>Vence el {fmtDate(renewItem.valid_until)}. La renovación suma {renewItem.duration_days ?? renewProduct?.duration_days ?? 30} días.</p>
        <p><strong>Total a depositar: {money(renewPrice)}</strong></p>
        <BankAccountsBox banks={banks} />
        <label>Referencia NC<input value={pay.reference} onChange={e => pay.setReference(e.target.value)} /></label>
        <label>Fecha del depósito<input type="date" value={pay.depositDate} onChange={e => pay.setDepositDate(e.target.value)} /></label>
        <ReceiptPicker receipt={pay.receipt} onChange={pay.setReceipt} />
        <StreamingConditions />
        <CheckboxRow checked={pay.acceptService} onChange={pay.setAcceptService}>Leí y acepto las condiciones del servicio</CheckboxRow>
        <CheckboxRow checked={pay.acceptTerms} onChange={pay.setAcceptTerms}>Acepto los términos y condiciones</CheckboxRow>
        <StickySubmit message={message} loading={loading} label="Enviar renovación" onClick={() => { void submitRenewal() }} />
      </div>
    </>
  )
}
