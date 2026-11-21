import { useState } from 'react'
import { useStore } from '@/store/StoreProvider'

export function BanksTab() {
  const { supabase, isAdmin, banks, loading, setMessage, refreshAdmin } = useStore()
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  async function saveBank() {
    if (!isAdmin) return
    if (!bankName.trim() || !bankAccount.trim()) {
      setMessage('Completa banco y número de cuenta.')
      return
    }
    const { error } = await supabase.from('bank_accounts').insert({
      bank_name: bankName.trim(),
      account_number: bankAccount.trim(),
      account_holder: bankHolder.trim(),
      active: true,
    })
    if (error) setMessage(`Error al guardar cuenta: ${error.message}`)
    else {
      setBankName('')
      setBankAccount('')
      setBankHolder('')
      setMessage('Cuenta bancaria guardada.')
      await refreshAdmin()
    }
  }

  return (
    <div className="admin-form" style={{ marginTop: 20 }}>
      <h3>Mis cuentas bancarias</h3>
      <input placeholder="Banco (Ej. Banrural)" value={bankName} onChange={e => setBankName(e.target.value)} />
      <input placeholder="Número de cuenta" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
      <input placeholder="Titular" value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
      <button className="button" disabled={loading} onClick={() => { void saveBank() }}>Guardar cuenta</button>
      <ul>{banks.map(b => <li key={b.id}>{b.bank_name} — {b.account_number} ({b.account_holder})</li>)}</ul>
    </div>
  )
}
