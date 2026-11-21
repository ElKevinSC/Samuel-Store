// Piezas del formulario de pago que se repiten en pedido y renovación.
import type { ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { RECEIPT_ACCEPT } from '@/lib/receipts'
import type { Bank } from '@/store/types'

export function BankAccountsBox({ banks }: { banks: Bank[] }) {
  return (
    <div style={{ backgroundColor: '#003366', padding: 15, borderRadius: 8, margin: '10px 0' }}>
      <h4 style={{ margin: '0 0 10px' }}>Datos para depositar</h4>
      {banks.length === 0 && <p>No hay cuentas bancarias disponibles.</p>}
      {banks.map(b => (
        <div key={b.id} style={{ marginBottom: 10 }}>
          <p>Banco: <strong>{b.bank_name}</strong></p>
          <p>Cuenta: <strong>{b.account_number}</strong></p>
          <p>Titular: <strong>{b.account_holder}</strong></p>
        </div>
      ))}
      <p style={{ fontSize: 11, color: '#ffcc00' }}>Deposita el monto exacto y sube el comprobante.</p>
    </div>
  )
}

export function ReceiptPicker({ receipt, onChange }: { receipt: File | null; onChange: (f: File | null) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#222', padding: 10, borderRadius: 5 }}>
      <Upload size={20} />{receipt ? receipt.name : 'Seleccionar comprobante'}
      <input type="file" style={{ display: 'none' }} accept={RECEIPT_ACCEPT} onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </label>
  )
}

export function CheckboxRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center', fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 22, height: 22, minWidth: 22, margin: 0, padding: 0, flex: '0 0 22px' }} />
      <span>{children}</span>
    </label>
  )
}

export function StickySubmit({ message, loading, label, onClick }: { message: string; loading: boolean; label: string; onClick: () => void }) {
  return (
    <div style={{ position: 'sticky', bottom: 0, background: '#0b1320', padding: '10px 0', zIndex: 5 }}>
      {message && <p role="status" style={{ color: '#00a3ff', marginBottom: 8 }}>{message}</p>}
      <button className="button" style={{ width: '100%' }} disabled={loading} onClick={onClick}>{loading ? 'Enviando...' : label}</button>
    </div>
  )
}
