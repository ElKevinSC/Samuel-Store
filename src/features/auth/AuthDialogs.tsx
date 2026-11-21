// Iniciar sesión, registrarse, recuperar y cambiar contraseña.
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '@/store/StoreProvider'
import type { AuthDraft } from './useAuthDraft'

export function LoginRegisterDialog({ auth }: { auth: AuthDraft }) {
  const { supabase, modal, setModal, loading, setLoading, message, setMessage } = useStore()
  const isLogin = modal === 'login'

  async function submitAuth() {
    setLoading(true)
    setMessage('')
    if (!isLogin) {
      const { error } = await supabase.auth.signUp({
        email: auth.email.trim(),
        password: auth.password,
        options: { data: { full_name: auth.fullName.trim() } },
      })
      setMessage(error ? error.message : 'Cuenta creada. Revisa tu correo para confirmar si se solicita.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: auth.email.trim(), password: auth.password })
      if (error) setMessage(error.message)
      else {
        setModal(null)
        auth.setPassword('')
      }
    }
    setLoading(false)
  }

  return (
    <>
      <DialogHeader><DialogTitle>{isLogin ? 'Iniciar sesión' : 'Registrarse'}</DialogTitle></DialogHeader>
      <div className="auth-form">
        {!isLogin && <label>Nombre completo<input value={auth.fullName} onChange={e => auth.setFullName(e.target.value)} /></label>}
        <label>Correo<input type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} /></label>
        <label>Contraseña<input type="password" value={auth.password} onChange={e => auth.setPassword(e.target.value)} /></label>
        <button className="button" disabled={loading} onClick={() => { void submitAuth() }}>{loading ? 'Procesando...' : isLogin ? 'Entrar' : 'Crear cuenta'}</button>
        {isLogin && <button type="button" onClick={() => { setMessage(''); setModal('forgot') }} style={{ textDecoration: 'underline', fontSize: 13 }}>¿Olvidaste tu contraseña?</button>}
        {message && <p role="status">{message}</p>}
      </div>
    </>
  )
}

export function ForgotPasswordDialog({ auth }: { auth: AuthDraft }) {
  const { supabase, setModal, loading, setLoading, message, setMessage } = useStore()

  async function sendReset() {
    if (!auth.email.trim()) {
      setMessage('Escribe tu correo.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(auth.email.trim(), { redirectTo: `${window.location.origin}/?auth_action=recover` })
    setLoading(false)
    setMessage(error ? error.message : 'Si ese correo tiene cuenta, te enviamos un enlace para cambiar tu contraseña. Revisa también la carpeta de spam.')
  }

  return (
    <>
      <DialogHeader><DialogTitle>Recuperar contraseña</DialogTitle><DialogDescription>Te enviaremos un enlace a tu correo.</DialogDescription></DialogHeader>
      <div className="auth-form">
        <label>Correo<input type="email" value={auth.email} onChange={e => auth.setEmail(e.target.value)} /></label>
        <button className="button" disabled={loading} onClick={() => { void sendReset() }}>{loading ? 'Enviando...' : 'Enviar enlace'}</button>
        <button className="button secondary small" onClick={() => { setMessage(''); setModal('login') }}>Volver a iniciar sesión</button>
        {message && <p role="status">{message}</p>}
      </div>
    </>
  )
}

export function NewPasswordDialog({ auth }: { auth: AuthDraft }) {
  const { supabase, setModal, loading, setLoading, message, setMessage, showToast } = useStore()

  async function savePassword() {
    if (auth.newPass.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: auth.newPass })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    auth.setNewPass('')
    setMessage('')
    setModal(null)
    if (new URLSearchParams(window.location.search).has('auth_action')) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    showToast('Contraseña actualizada')
  }

  return (
    <>
      <DialogHeader><DialogTitle>Nueva contraseña</DialogTitle><DialogDescription>Escribe una contraseña nueva de al menos 8 caracteres.</DialogDescription></DialogHeader>
      <div className="auth-form">
        <label>Nueva contraseña<input type="password" value={auth.newPass} onChange={e => auth.setNewPass(e.target.value)} /></label>
        <button className="button" disabled={loading} onClick={() => { void savePassword() }}>{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
        {message && <p role="status">{message}</p>}
      </div>
    </>
  )
}
