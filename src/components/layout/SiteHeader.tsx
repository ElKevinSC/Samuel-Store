import { useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { useStore } from '@/store/StoreProvider'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export function SiteHeader() {
  const { supabase, user, isAdmin, isReseller, setModal, setMessage } = useStore()
  const [menu, setMenu] = useState(false)

  return (
    <header className="header wrap">
      <a className="brand" href="#inicio">
        <img className="brand-logo" src="/images/samuel-store-logo.jpg" alt="Samuel Store" />
      </a>
      <nav className={menu ? 'navigation open' : 'navigation'}>
        <a className="active" href="#inicio" onClick={() => setMenu(false)}>Inicio</a>
        <a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a>
        <a href="#ayuda" onClick={() => setMenu(false)}>Ayuda</a>
        <button onClick={() => { setModal(user ? 'my_orders' : 'login'); setMenu(false) }}>Mis pedidos</button>
        <button onClick={() => { setModal(user ? 'my_subs' : 'login'); setMenu(false) }}>Mis suscripciones</button>
        {isReseller && !isAdmin && <a href="#reseller-panel" onClick={() => setMenu(false)}>Mi negocio</a>}
      </nav>
      <div className="account">
        {user ? (
          <>
            <span className="login">{user.email}</span>
            {isAdmin && <button className="button small" onClick={() => scrollTo('admin-panel')}>Administrar</button>}
            {isReseller && !isAdmin && <button className="button small" onClick={() => scrollTo('reseller-panel')}>Mi negocio</button>}
            <button className="button small" onClick={() => { void supabase.auth.signOut() }}><LogOut size={14} /> Salir</button>
          </>
        ) : (
          <>
            <button className="login" onClick={() => { setMessage(''); setModal('login') }}>Iniciar sesión</button>
            <button className="button small" onClick={() => { setMessage(''); setModal('register') }}>Registrarse</button>
          </>
        )}
        <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      </div>
    </header>
  )
}
