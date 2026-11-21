// Un solo <Dialog> para toda la tienda: muestra el contenido del diálogo activo.
// Los borradores (pago y acceso) viven aquí para que no se pierdan al cambiar de diálogo.
import { useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ForgotPasswordDialog, LoginRegisterDialog, NewPasswordDialog } from '@/features/auth/AuthDialogs'
import { useAuthDraft } from '@/features/auth/useAuthDraft'
import { CheckoutDialog } from '@/features/checkout/CheckoutDialog'
import { usePaymentDraft } from '@/features/checkout/usePaymentDraft'
import { LegalDialog, PrivacyDialog, TermsDialog } from '@/features/legal/LegalDialogs'
import { MyOrdersDialog, OrderDoneDialog, UserOrdersDialog } from '@/features/orders/OrderDialogs'
import { ResellerApplyDialog } from '@/features/reseller/ResellerApplyDialog'
import { MySubscriptionsDialog } from '@/features/streaming/MySubscriptionsDialog'
import { RenewDialog } from '@/features/streaming/RenewDialog'
import { useStore } from '@/store/StoreProvider'

export function StoreDialogs() {
  const { modal, setModal, setMessage, cart, checkoutSession, renewItem } = useStore()
  const auth = useAuthDraft()
  const pay = usePaymentDraft()

  // Cada vez que se abre el pago desde el carrito se pide el ID o WhatsApp de nuevo.
  const { setPlayerId } = pay
  useEffect(() => { setPlayerId('') }, [checkoutSession, setPlayerId])

  // Al elegir una cuenta para renovar (desde Mis suscripciones o Mi negocio), el pago empieza limpio.
  const { setReference, setDepositDate, setReceipt, setAcceptTerms, setAcceptService } = pay
  useEffect(() => {
    if (!renewItem) return
    setReference('')
    setDepositDate('')
    setReceipt(null)
    setAcceptTerms(false)
    setAcceptService(false)
  }, [renewItem, setReference, setDepositDate, setReceipt, setAcceptTerms, setAcceptService])

  return (
    <Dialog open={!!modal} onOpenChange={open => { if (!open) { setModal(null); setMessage('') } }}>
      <DialogContent className="store-dialog" style={{ maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {(modal === 'login' || modal === 'register') && <LoginRegisterDialog auth={auth} />}
        {modal === 'forgot' && <ForgotPasswordDialog auth={auth} />}
        {modal === 'new_password' && <NewPasswordDialog auth={auth} />}
        {modal === 'reseller_apply' && <ResellerApplyDialog auth={auth} />}
        {modal === 'terms' && <TermsDialog />}
        {modal === 'legal' && <LegalDialog />}
        {modal === 'privacy' && <PrivacyDialog />}
        {modal === 'checkout' && cart.length > 0 && <CheckoutDialog pay={pay} />}
        {modal === 'order_done' && <OrderDoneDialog />}
        {modal === 'my_orders' && <MyOrdersDialog />}
        {modal === 'user_orders' && <UserOrdersDialog />}
        {modal === 'my_subs' && <MySubscriptionsDialog pay={pay} />}
        {modal === 'renew' && <RenewDialog pay={pay} />}
      </DialogContent>
    </Dialog>
  )
}
