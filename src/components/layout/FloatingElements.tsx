// Elementos fijos en pantalla: botón de WhatsApp, aviso flotante (toast),
// botón del carrito y aviso de cookies.
import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { STORE_WHATSAPP } from '@/lib/whatsapp'
import { useStore } from '@/store/StoreProvider'

export function FloatingWhatsApp() {
  return (
    <a
      href={`https://wa.me/${STORE_WHATSAPP}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Escríbenos por WhatsApp"
      style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50, background: '#25d366', color: '#fff', fontWeight: 700, padding: '12px 18px', borderRadius: 999, boxShadow: '0 4px 14px rgba(0,0,0,.4)' }}
    >
      WhatsApp
    </a>
  )
}

export function ToastMessage() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 140, zIndex: 60, background: '#0b1320', border: '1px solid #00a3ff', color: '#fff', padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}>
      {toast}
    </div>
  )
}

export function FloatingCartButton() {
  const { cart, openCheckout } = useStore()
  if (cart.length === 0) return null
  return (
    <button
      aria-label="Ver carrito"
      onClick={() => openCheckout()}
      style={{ position: 'fixed', right: 16, bottom: 76, zIndex: 50, background: '#00a3ff', color: '#fff', width: 56, height: 56, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.4)' }}
    >
      <ShoppingCart size={24} />
      <span style={{ position: 'absolute', top: -4, right: -4, background: '#f06675', color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 22, height: 22, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cart.reduce((t, item) => t + item.quantity, 0)}
      </span>
    </button>
  )
}

export function CookieBanner() {
  const { setModal } = useStore()
  const [cookieOk, setCookieOk] = useState(true)
  useEffect(() => {
    try { if (!localStorage.getItem('cookies_ok')) setCookieOk(false) } catch { /* nada */ }
  }, [])
  if (cookieOk) return null
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, background: '#0b1320', borderTop: '1px solid #00a3ff', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13 }}>Usamos el almacenamiento del navegador solo para mantener tu sesión. No usamos cookies de publicidad. Más información en la <button type="button" onClick={() => setModal('privacy')} style={{ textDecoration: 'underline' }}>política de privacidad</button>.</p>
      <button className="button small" onClick={() => { try { localStorage.setItem('cookies_ok', '1') } catch { /* nada */ } setCookieOk(true) }}>Entendido</button>
    </div>
  )
}
