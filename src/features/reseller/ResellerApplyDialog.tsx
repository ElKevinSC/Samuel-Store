import { useState } from 'react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AuthDraft } from '@/features/auth/useAuthDraft'
import { RESELLER_MIN } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'

export function ResellerApplyDialog({ auth }: { auth: AuthDraft }) {
  const { supabase, user, loading, setLoading, message, setMessage, setModal, showToast, setResellerApplicationStatus } = useStore()
  const [resAge, setResAge] = useState('')
  const [expectedSales, setExpectedSales] = useState('')
  const [resellerWhatsapp, setResellerWhatsapp] = useState('')

  async function applyReseller() {
    if (loading) return
    if (!user) {
      setMessage('Inicia sesión para enviar tu solicitud.')
      return
    }

    const cleanWhatsapp = resellerWhatsapp.replace(/\D/g, '')
    const whatsapp = cleanWhatsapp.length === 8 ? `502${cleanWhatsapp}` : cleanWhatsapp
    const name = auth.fullName.trim()
    const age = Number(resAge)
    const sales = Number(expectedSales)

    if (!name) {
      setMessage('Escribe tu nombre completo.')
      return
    }
    if (!Number.isInteger(age) || age < 18 || age > 120) {
      setMessage('Debes tener al menos 18 años. Revisa la edad ingresada.')
      return
    }
    if (!/^502[0-9]{8}$/.test(whatsapp)) {
      setMessage('Escribe tu WhatsApp de Guatemala (8 dígitos, con 502 opcional).')
      return
    }
    if (!Number.isFinite(sales) || sales < RESELLER_MIN) {
      setMessage(`Las ventas estimadas deben ser de Q${RESELLER_MIN} o más.`)
      return
    }

    setLoading(true)
    setMessage('Guardando tu solicitud...')
    try {
      // Un UPDATE normal puede afectar 0 filas SIN devolver un error.
      // Primero averiguamos si el usuario ya tiene perfil para insertar si falta.
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id,role,application_status')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw new Error(`No se pudo leer tu perfil: ${profileError.message}`)
      if (currentProfile && currentProfile.role !== 'customer') {
        throw new Error('Tu cuenta ya tiene un rol diferente al de cliente.')
      }
      if (currentProfile && ['approved', 'rejected'].includes(currentProfile.application_status ?? '')) {
        throw new Error('Tu solicitud ya fue resuelta. Contacta a Samuel Store para volver a solicitar.')
      }

      const dataToSave = { full_name: name, age, whatsapp, expected_sales: sales, application_status: 'pending' }
      const columns = 'id,full_name,age,whatsapp,expected_sales,application_status'

      const { data: saved, error: saveError } = currentProfile
        ? await supabase.from('profiles').update(dataToSave).eq('id', user.id).select(columns).maybeSingle()
        : await supabase.from('profiles').insert({ id: user.id, role: 'customer', ...dataToSave }).select(columns).maybeSingle()

      if (saveError) throw new Error(saveError.message)
      if (!saved) throw new Error('Supabase no guardó ninguna fila. Revisa los permisos del perfil.')
      if (saved.application_status !== 'pending') throw new Error('El estado no quedó pendiente; revisa los triggers del perfil.')
      if (Number(saved.expected_sales) !== sales) throw new Error('Las ventas estimadas no se guardaron; aplica el SQL de seguridad adjunto.')
      if (saved.whatsapp !== whatsapp || saved.full_name !== name || Number(saved.age) !== age) {
        throw new Error('Los datos no se guardaron completos. Revisa la configuración del perfil.')
      }

      // La confirmación solo se muestra después de verificar la fila en Supabase.
      setResellerApplicationStatus('pending')
      setResAge('')
      setResellerWhatsapp('')
      setExpectedSales('')
      setMessage('')
      setModal(null)
      showToast('¡Solicitud enviada y guardada! Pendiente de aprobación.')
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error al enviar solicitud de revendedor:', err)
      setMessage(`No se pudo enviar la solicitud: ${detail}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader><DialogTitle>Solicitar ser revendedor</DialogTitle><DialogDescription>Ventas estimadas mínimas: Q{RESELLER_MIN} al mes.</DialogDescription></DialogHeader>
      <div className="auth-form">
        <label>Nombre completo<input value={auth.fullName} onChange={e => auth.setFullName(e.target.value)} /></label>
        <label>Edad<input type="number" min="18" value={resAge} onChange={e => setResAge(e.target.value)} /></label>
        <label>WhatsApp<input type="tel" inputMode="tel" placeholder="Ejemplo: 54560623" value={resellerWhatsapp} onChange={e => setResellerWhatsapp(e.target.value)} /></label>
        <label>Ventas estimadas al mes (Q)<input type="number" min={RESELLER_MIN} value={expectedSales} onChange={e => setExpectedSales(e.target.value)} /></label>
        <button type="button" className="button" disabled={loading} onClick={() => { void applyReseller() }}>{loading ? 'Enviando...' : 'Enviar solicitud'}</button>
        {message && <p role="status">{message}</p>}
      </div>
    </>
  )
}
