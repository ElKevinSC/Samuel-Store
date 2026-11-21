import { STORE_WHATSAPP } from '@/lib/whatsapp'
import { useStore } from '@/store/StoreProvider'

export function SiteFooter() {
  const { setModal, setMessage } = useStore()
  const open = (m: 'legal' | 'privacy' | 'terms') => { setMessage(''); setModal(m) }

  return (
    <footer className="wrap" style={{ borderTop: '1px solid #1b2a3a', marginTop: 40, padding: '28px 0 90px', textAlign: 'center' }}>
      <h3>Síguenos en @SamuelStoreGt</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', margin: '14px 0' }}>
        <a className="button small" href="https://www.facebook.com/SamuelStoreGt" target="_blank" rel="noreferrer">Facebook</a>
        <a className="button small" href="https://www.instagram.com/SamuelStoreGt" target="_blank" rel="noreferrer">Instagram</a>
        <a className="button small" href="https://www.tiktok.com/@SamuelStoreGt" target="_blank" rel="noreferrer">TikTok</a>
        <a className="button small" href={`https://wa.me/${STORE_WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
        <button onClick={() => open('legal')} style={{ textDecoration: 'underline' }}>Aviso legal</button>
        <button onClick={() => open('privacy')} style={{ textDecoration: 'underline' }}>Política de privacidad</button>
        <button onClick={() => open('terms')} style={{ textDecoration: 'underline' }}>Términos y condiciones</button>
      </p>
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
        © 2026 Samuel Store. Todos los derechos reservados. Guatemala.
      </p>
      <p style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
        Free Fire, Blood Strike y Roblox son marcas de sus respectivos dueños. Samuel Store no está afiliada a ellos.
      </p>
    </footer>
  )
}
