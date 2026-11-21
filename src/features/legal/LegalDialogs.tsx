import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LEGAL_SECTIONS, LEGAL_UPDATED, PRIVACY_SECTIONS, TERMS_SECTIONS } from '@/data/legal'
import { useStore } from '@/store/StoreProvider'

function Sections({ sections }: { sections: [string, string][] }) {
  return (
    <div style={{ maxHeight: '60dvh', overflowY: 'auto', fontSize: 14, lineHeight: 1.5 }}>
      {sections.map(([title, text]) => <p key={title} style={{ marginBottom: 10 }}><strong>{title}</strong><br />{text}</p>)}
      <p style={{ fontSize: 12, opacity: 0.7 }}>{LEGAL_UPDATED}</p>
    </div>
  )
}

export function LegalDialog() {
  return <><DialogHeader><DialogTitle>Aviso legal</DialogTitle></DialogHeader><Sections sections={LEGAL_SECTIONS} /></>
}

export function PrivacyDialog() {
  return <><DialogHeader><DialogTitle>Política de privacidad</DialogTitle></DialogHeader><Sections sections={PRIVACY_SECTIONS} /></>
}

export function TermsDialog() {
  const { cart, setModal } = useStore()
  return (
    <>
      <DialogHeader><DialogTitle>Términos y condiciones</DialogTitle></DialogHeader>
      <Sections sections={TERMS_SECTIONS} />
      {cart.length > 0 && <button className="button small" onClick={() => setModal('checkout')}>Volver al pago</button>}
    </>
  )
}
