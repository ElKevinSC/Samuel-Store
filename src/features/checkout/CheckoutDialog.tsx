import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { money } from '@/data/catalog'
import { StreamingConditions } from '@/features/streaming/StreamingConditions'
import { receiptProblem, removeReceipt, uploadReceipt } from '@/lib/receipts'
import { STORE_WHATSAPP } from '@/lib/whatsapp'
import { useStore } from '@/store/StoreProvider'
import { BankAccountsBox, CheckboxRow, ReceiptPicker, StickySubmit } from './PaymentFields'
import type { PaymentDraft } from './usePaymentDraft'

export function CheckoutDialog({ pay }: { pay: PaymentDraft }) {
  const s = useStore()
  const { supabase, user, cart, unitPrice, cartTotal, banks, loading, setLoading, message, setMessage, setModal } = s
  const cartContact = cart[0]?.product.contact_type ?? 'player_id'
  const cartIsStreaming = cart[0]?.product.category === 'Streaming'

  async function submitOrder() {
    if (!user || cart.length === 0) {
      setMessage('Inicia sesión y agrega paquetes al carrito.')
      return
    }
    const { playerId, reference, depositDate, receipt } = pay
    if (!playerId.trim() || !reference.trim() || !depositDate || !receipt || cartTotal <= 0) {
      setMessage('Completa todos los campos y adjunta el comprobante.')
      return
    }
    if (!pay.acceptTerms) {
      setMessage('Debes aceptar los términos y condiciones.')
      return
    }
    if (cartIsStreaming && !pay.acceptService) {
      setMessage('Debes aceptar las condiciones del servicio de streaming.')
      return
    }
    if (cartContact === 'whatsapp') {
      const digits = playerId.replace(/\D/g, '')
      if (!(digits.length === 8 || (digits.length >= 10 && digits.length <= 15))) {
        setMessage('Escribe un número de WhatsApp válido.')
        return
      }
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
    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_player_id: playerId.trim(),
      p_reference_nc: reference.trim(),
      p_deposit_date: depositDate,
      p_receipt_path: uploaded.path,
      p_amount: cartTotal,
      p_items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
    })
    if (error) {
      await removeReceipt(supabase, uploaded.path)
      setLoading(false)
      setMessage(`No se pudo guardar el pedido: ${error.message}`)
      return
    }
    setLoading(false)
    setModal(null)
    const first = cart[0].product
    const lines = cart.map(item => `• ${item.quantity} x ${item.product.detail || item.product.name}`).join('\n')
    const isWa = first.contact_type === 'whatsapp'
    const text = `Hola Samuel Store, acabo de hacer un pedido.\n\nPedido: ${String(orderId ?? '').slice(0, 8)}\n${cartIsStreaming ? 'Plataforma' : 'Juego'}: ${first.game_name || 'Otros'}\n${isWa ? 'Mi WhatsApp' : 'ID de jugador'}: ${playerId.trim()}\n\nPaquetes:\n${lines}\n\nTotal: ${money(cartTotal)}\nReferencia NC: ${reference.trim()}\n\nYa envié mi comprobante en la tienda.`
    s.setLastOrder({ waLink: `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(text)}`, isStreaming: cartIsStreaming })
    setMessage('')
    setModal('order_done')
    await s.refreshMyOrders(user.id)
    s.clearCart()
    pay.reset()
  }

  return (
    <>
      <DialogHeader><DialogTitle>Completar pedido</DialogTitle><DialogDescription>Deposita el monto y adjunta tu comprobante.</DialogDescription></DialogHeader>
      <div className="auth-form">
        <div style={{ background: '#222', padding: 10, borderRadius: 8 }}>
          {cart.map(item => (
            <p key={item.product.id}>
              {item.quantity} × <strong>{item.product.detail || item.product.name}</strong> — {money(unitPrice(item.product) * item.quantity)}
            </p>
          ))}
          <p><strong>Total a depositar: {money(cartTotal)}</strong></p>
        </div>
        <label>{cartContact === 'whatsapp' ? 'Tu número de WhatsApp' : 'ID de jugador'}<input value={pay.playerId} inputMode={cartContact === 'whatsapp' ? 'tel' : undefined} onChange={e => pay.setPlayerId(e.target.value)} placeholder={cartContact === 'whatsapp' ? 'Ej. 50212345678' : 'Ej. 12345678'} /></label>
        {cartContact === 'whatsapp' && <p style={{ fontSize: 12, opacity: 0.8 }}>Por este número te enviaremos tu pedido. Escríbelo con código de país (Guatemala: 502).</p>}
        <BankAccountsBox banks={banks} />
        <label>Referencia NC<input value={pay.reference} onChange={e => pay.setReference(e.target.value)} /></label>
        <label>Monto depositado (Q)<input type="number" value={String(cartTotal)} readOnly /></label>
        <label>Fecha del depósito<input type="date" value={pay.depositDate} onChange={e => pay.setDepositDate(e.target.value)} /></label>
        <ReceiptPicker receipt={pay.receipt} onChange={pay.setReceipt} />
        {cartIsStreaming && (
          <>
            <StreamingConditions />
            <CheckboxRow checked={pay.acceptService} onChange={pay.setAcceptService}>Leí y acepto las condiciones del servicio</CheckboxRow>
          </>
        )}
        <CheckboxRow checked={pay.acceptTerms} onChange={pay.setAcceptTerms}>
          Acepto los <button type="button" onClick={() => setModal('terms')} style={{ textDecoration: 'underline' }}>términos y condiciones</button>
        </CheckboxRow>
        <StickySubmit message={message} loading={loading} label="Confirmar pedido" onClick={() => { void submitOrder() }} />
      </div>
    </>
  )
}
