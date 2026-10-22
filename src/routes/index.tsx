import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { ArrowUpRight, ArrowRight, Gamepad2, Zap, ShieldCheck, Headphones, Play, Users, ShoppingBag, Search, Menu, X, ChevronRight, Landmark, Check, Globe, Sparkles, Layers } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ControllerArt } from '@/components/store/controller-art'
import { demoProducts, money, type Category, type Product } from '@/data/catalog'

export const Route = createFileRoute('/')({ component: Home })
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
type DbProduct = { id: string; name: string; detail: string; category: Category; price: number; reseller_price: number; image_url?: string | null; active: boolean; label?: string | null; art?: string | null }
const categories = [
  { name: 'Videojuegos' as Category, text: 'Lleva tu juego al siguiente nivel', icon: Gamepad2, style: 'gaming' },
  { name: 'Streaming' as Category, text: 'Tus series, música y más', icon: Play, style: 'streaming' },
  { name: 'Redes sociales' as Category, text: 'Haz crecer tu presencia digital', icon: Users, style: 'networks' },
  { name: 'Reventa' as Category, text: 'Más oportunidades para ti', icon: Layers, style: 'resale' },
]
function Home() {
  const [category, setCategory] = useState<Category>('Todos')
  const [role, setRole] = useState<'client' | 'reseller'>('client')
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState<'login' | 'register' | 'orders' | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [dbProducts, setDbProducts] = useState<DbProduct[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminDetail, setAdminDetail] = useState('')
  const [adminCategory, setAdminCategory] = useState<Category>('Videojuegos')
  const [adminPrice, setAdminPrice] = useState('')
  const [adminResellerPrice, setAdminResellerPrice] = useState('')
  const [adminImage, setAdminImage] = useState('')
  const [catalogReady, setCatalogReady] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) setUser(data.session?.user ?? null) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setUser(session?.user ?? null) })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!supabase || !user) { setIsAdmin(false); return }
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle().then(({ data }) => {
      setIsAdmin(data?.role === 'admin')
      if (data?.role === 'admin') void refreshUsers()
    })
  }, [user])
  
  async function refreshUsers() {
    if (!supabase) return
    const { data, error } = await supabase.from('profiles').select('id, full_name, role')
    if (!error && data) setAllUsers(data)
  }

  async function updateUserRole(userId: string, newRole: string) {
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) setAuthMessage(error.message)
    else { setAuthMessage('Rol actualizado correctamente.'); await refreshUsers() }
  }

  async function refreshProducts() {
    if (!supabase) return
    const { data, error } = await supabase.from('products').select('id,name,detail,category,price,reseller_price,image_url,active,label,art').eq('active', true).order('created_at', { ascending: false })
    if (error) { setAuthMessage(`No se pudo cargar el catálogo: ${error.message}`); return }
    setDbProducts((data ?? []) as DbProduct[]); setCatalogReady(true)
  }
  useEffect(() => { if (supabase) void refreshProducts() }, [])
  const sourceProducts: Product[] = catalogReady ? dbProducts.map(p => ({ id: p.id, name: p.name, detail: p.detail, category: p.category, price: Number(p.price), resellerPrice: Number(p.reseller_price), art: p.art || 'reseller', label: p.label || p.category })) : demoProducts
  const products = sourceProducts.filter(p => (category === 'Todos' || p.category === category) && `${p.name} ${p.detail}`.toLowerCase().includes(search.toLowerCase()))
  
  async function submitAuth() {
    if (!supabase) { setAuthMessage('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Netlify.'); return }
    setAuthMessage('')
    if (modal === 'register') {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } })
      setAuthMessage(error ? error.message : 'Registro enviado. Si Supabase exige confirmación por correo, revisa tu bandeja antes de iniciar sesión.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      setAuthMessage(error ? error.message : 'Sesión iniciada correctamente.')
    }
  }
  
  async function saveProduct() {
    if (!supabase || !isAdmin) { setAuthMessage('Solo una cuenta con rol administrador puede guardar productos.'); return }
    const { error } = await supabase.from('products').insert({ name: adminName, detail: adminDetail, category: adminCategory, price: Number(adminPrice), reseller_price: Number(adminResellerPrice || adminPrice), image_url: adminImage || null, active: true, label: adminCategory, art: 'reseller' })
    if (error) { setAuthMessage(`No se pudo guardar: ${error.message}`); return }
    setAdminName(''); setAdminDetail(''); setAdminPrice(''); setAdminResellerPrice(''); setAdminImage(''); setAuthMessage('Producto guardado.'); await refreshProducts()
  }
  
  async function deleteProduct(id: string) {
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    setAuthMessage(error ? error.message : 'Producto eliminado.'); if (!error) await refreshProducts()
  }
  
  function selectCategory(value: Category) { setCategory(value); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }) }
  
  return <div className="storefront">
    <div className="topbar"><span className="status-dot"/> Tu próximo nivel empieza aquí <span className="top-divider">/</span><span>De Guatemala para tu mundo digital</span><span className="country">GT <span className="flag">▌▌▌</span></span></div>
    <header className="header wrap">
      <a className="brand" href="#inicio" aria-label="Samuel Store, inicio"><img className="brand-logo" src="/images/samuel-store-logo.jpg" alt="Samuel Store" width="1280" height="1280"/></a>
      <nav className={menu ? 'navigation open' : 'navigation'} aria-label="Principal"><a className="active" href="#inicio" onClick={() => setMenu(false)}>Inicio</a><a href="#categorias" onClick={() => setMenu(false)}>Categorías</a><a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a><button onClick={() => { setModal('orders'); setMenu(false) }}>Mis pedidos</button></nav>
      <div className="account">{user ? <><span className="login">{user.email}</span>{isAdmin && <button className="button small" onClick={() => { setAuthMessage(''); setModal(null); document.getElementById('admin-panel')?.scrollIntoView({ behavior: 'smooth' }) }}>Administrar</button>}<button className="button small" onClick={async () => { await supabase?.auth.signOut(); setIsAdmin(false); setAuthMessage('Sesión cerrada.') }}>Salir</button></> : <><button className="login" onClick={() => { setAuthMessage(''); setModal('login') }}>Iniciar sesión</button><button className="button small" onClick={() => { setAuthMessage(''); setModal('register') }}>Registrarse <ArrowUpRight size={15}/></button></>}<button className="mobile-menu" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button></div>
    </header>
    <main>
      <section className="hero wrap" id="inicio">
        <div className="hero-copy"><div className="eyebrow"><span/> TU UNIVERSO DIGITAL, SIN LÍMITES</div><h1>Tu juego.<br/>Tu mundo.<br/><span>Tu siguiente nivel.</span></h1><p className="slogan">En Samuel Store, tu meta es nuestra meta.</p><p className="hero-description">Recargas, entretenimiento y servicios digitales.<br className="desktop-break"/> Todo lo que necesitas, en un solo lugar.</p><div className="hero-actions"><a className="button" href="#catalogo">Explorar catálogo <ArrowRight size={18}/></a><button className="button secondary" onClick={() => { setRole('reseller'); selectCategory('Todos') }}><Users size={17}/> Quiero revender</button></div><div className="hero-note"><ShieldCheck size={15}/><span>Atención cercana</span><span className="note-dot"/><span>Precios en quetzales</span></div></div>
        <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-grid"/><span className="art-coordinate">SS / DIGITAL EXPERIENCE</span><div className="level-caption">PLAY<br/><span>WITHOUT LIMITS.</span></div><ControllerArt/><div className="float-card instant"><span className="float-icon"><Zap size={22}/></span><div>Más diversión.<strong>Un solo lugar.</strong></div><ArrowUpRight size={17}/></div><div className="float-card gamer"><span className="float-icon"><Gamepad2 size={22}/></span><div>Para los que juegan<strong>con todo.</strong></div><span className="blue-dot"/></div><div className="art-bottom"><span>GAMING · STREAMING · DIGITAL</span><span>01 — 04</span></div><span className="cross cross-one">+</span><span className="cross cross-two">+</span></div>
      </section>
      <div className="benefits wrap"><div><Zap/><span>Tu entretenimiento<strong>sin complicaciones</strong></span></div><div><Landmark/><span>Pagos manuales por<strong>Cajas Rurales Banrural</strong></span></div><div><Users/><span>Precios especiales<strong>para revendedores</strong></span></div><div><Headphones/><span>Atención personal<strong>en cada paso</strong></span></div></div>
      <section className="section wrap" id="categorias"><div className="section-heading"><div><div className="eyebrow">ELIGE TU MUNDO</div><h2>¿Qué estás buscando?</h2></div><span className="section-caption">Todo tu mundo digital, más cerca.</span></div><div className="category-grid">{categories.map(({name, text, icon: Icon, style}) => <button key={name} className={`category-card ${style} ${category === name ? 'selected' : ''}`} onClick={() => selectCategory(name)}><span className="category-icon"><Icon size={27}/></span><ArrowUpRight className="category-arrow" size={20}/><h3>{name}</h3><p>{text}</p><span className="category-line"/></button>)}</div></section>
      <section className="section catalog wrap" id="catalogo"><div className="section-heading"><div><div className="eyebrow">RECARGA. CONECTA. DISFRUTA.</div><h2>Los favoritos de tu mundo<span className="blue-text">.</span></h2></div><div className="role-toggle" aria-label="Tipo de precio"><button className={role === 'client' ? 'chosen' : ''} onClick={() => setRole('client')}>Cliente</button><button className={role === 'reseller' ? 'chosen' : ''} onClick={() => setRole('reseller')}>Revendedor</button></div></div>
        <div className="catalog-toolbar"><div className="filters">{(['Todos', 'Videojuegos', 'Streaming', 'Redes sociales', 'Reventa'] as Category[]).map(c => <button key={c} className={category === c ? 'chosen' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><label className="search"><Search size={16}/><input aria-label="Buscar productos" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)}/></label></div>
        <div className="demo-notice"><Sparkles size={14}/><span>{supabase ? (catalogReady ? "Catálogo conectado a Supabase." : "Conectando catálogo...") : "Catálogo de demostración. Configura Supabase para activar el catálogo real."}</span><span className="demo-label">{catalogReady ? "EN LÍNEA" : "VISTA PREVIA"}</span></div>
        <div className="product-grid">{products.map(p => <article className="product-card" key={p.id}><div className={`product-art ${p.art}`}><span className="product-tag">{p.label}</span><span className="art-demo">DEMO</span>{p.image_url ? <img src={p.image_url} alt={p.name} className="db-product-image"/> : p.art === 'freefire' ? <div className="game-title">FREE F<span className="fire-i">I</span>RE<small>BATTLEGROUNDS</small></div> : p.art === 'netflix' ? <div className="netflix-logo">N</div> : p.art === 'pubg' ? <div className="pubg-logo">PUBG<small>MOBILE</small></div> : p.art === 'spotify' ? <div className="spotify-logo"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="currentColor"/><g fill="none" stroke="#09271a" strokeWidth="7" strokeLinecap="round"><path d="M23 37Q50 26 78 41M27 52Q50 43 73 56M31 66Q50 59 68 69"/></g></svg><span>Spotify</span></div> : p.art === 'social' ? <Users size={70}/> : <Layers size={70}/>}</div><div className="product-info"><div className="product-category">{p.category}</div><h3>{p.name}</h3><p>{p.detail}</p><div className="price-row"><div><span className="price-caption">Precio {role === 'client' ? 'cliente' : 'revendedor'}</span><strong>{money(role === 'client' ? p.price : p.resellerPrice)}</strong></div><button aria-label={`Ver ${p.name}`} onClick={() => setProduct(p)}><ArrowUpRight size={21}/></button></div><div className="other-price">{role === 'client' ? 'Revendedor' : 'Cliente'} <span>{money(role === 'client' ? p.resellerPrice : p.price)}</span></div></div></article>)}</div>
        {products.length === 0 && <div className="empty"><Search size={30}/><h3>No encontramos ese producto</h3><p>Prueba con otra búsqueda o explora todas las categorías.</p><button className="button secondary" onClick={() => { setSearch(''); setCategory('Todos') }}>Ver todos los productos</button></div>}
      </section>
      {isAdmin && <section className="section wrap" id="admin-panel"><div className="section-heading"><div><div className="eyebrow">ACCESO PROTEGIDO</div><h2>Panel de administración</h2></div></div><div className="admin-form"><h3>Agregar producto</h3><label>Nombre<input value={adminName} onChange={e => setAdminName(e.target.value)} /></label><label>Descripción<input value={adminDetail} onChange={e => setAdminDetail(e.target.value)} /></label><label>Categoría<select value={adminCategory} onChange={e => setAdminCategory(e.target.value as Category)}><option>Videojuegos</option><option>Streaming</option><option>Redes sociales</option><option>Reventa</option></select></label><label>Precio cliente (Q)<input type="number" min="0.01" step="0.01" value={adminPrice} onChange={e => setAdminPrice(e.target.value)} /></label><label>Precio revendedor (Q)<input type="number" min="0.01" step="0.01" value={adminResellerPrice} onChange={e => setAdminResellerPrice(e.target.value)} /></label><label>URL de imagen<input value={adminImage} onChange={e => setAdminImage(e.target.value)} placeholder="https://..." /></label><button className="button" onClick={() => void saveProduct()}>Guardar producto</button>{authMessage && <p role="status">{authMessage}</p>}
        <h3>Gestión de Usuarios</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #263b55', padding: '10px', borderRadius: '8px' }}>
          {allUsers.length === 0 ? <p style={{fontSize: '12px'}}>Cargando usuarios...</p> : allUsers.map(u => (
            <div key={u.id} className="admin-product-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #263b55' }}>
              <span style={{ fontSize: '13px' }}>{u.full_name || 'Usuario sin nombre'} — <strong style={{ color: u.role === 'reseller' ? '#00a3ff' : (u.role === 'admin' ? '#22c55e' : '#fff') }}>{u.role}</strong></span>
              {u.role !== 'admin' && (
                <button className="button secondary small" style={{ padding: '5px 10px', fontSize: '10px' }} onClick={() => void updateUserRole(u.id, u.role === 'reseller' ? 'customer' : 'reseller')}>
                  {u.role === 'reseller' ? 'Quitar Revendedor' : 'Hacer Revendedor'}
                </button>
              )}
            </div>
          ))}
        </div>
        <h3>Productos publicados</h3>{dbProducts.map(p => <div key={p.id} className="admin-product-row"><span>{p.name} — Q {Number(p.price).toFixed(2)}</span><button className="button secondary" onClick={() => void deleteProduct(p.id)}>Eliminar</button></div>)}</div></section>}
      <section className="reseller-banner wrap"><div className="banner-symbol"><Users size={43}/></div><div><div className="eyebrow">CRECE CON SAMUEL STORE</div><h2>Tu próximo negocio puede empezar aquí.</h2><p>Explora precios de reventa y encuentra tu siguiente oportunidad digital.</p></div><button className="button secondary" onClick={() => { setRole('reseller'); selectCategory('Todos') }}>Ver precios de reventa <ArrowUpRight size={17}/></button></section>
      <section className="section wrap payment" id="pagos"><div className="payment-intro"><div className="eyebrow">SIMPLE, PASO A PASO</div><h2>Tu pedido.<br/>A tu manera.</h2><p>Una vista previa del proceso de pedidos y pagos manuales en Guatemala.</p><div className="bank"><Landmark size={24}/><div>Cajas Rurales<strong>Banrural</strong></div><span>Pago manual</span></div></div><div className="payment-steps"><div><span className="step">01</span><div><h3>Elige tu producto</h3><p>Explora el catálogo y revisa el precio para cliente o revendedor.</p></div><ShoppingBag size={21}/></div><div><span className="step">02</span><div><h3>Realiza tu depósito</h3><p>Al habilitar las compras, recibirás los datos verificados para depositar en una Caja Rural Banrural.</p></div><Landmark size={21}/></div><div><span className="step">03</span><div><h3>Comparte tu comprobante</h3><p>El equipo revisará el pago antes de completar tu pedido.</p></div><Check size={21}/></div><p className="payment-notice"><ShieldCheck size={16}/> Demostración: los pedidos y depósitos aún no están habilitados. No realices pagos.</p></div></section>
    </main>
    <footer className="footer wrap"><a className="brand footer-brand" href="#inicio" aria-label="Samuel Store, inicio"><img className="brand-logo" src="/images/samuel-store-logo.jpg" alt="Samuel Store" width="1280" height="1280" loading="lazy"/></a><p>En Samuel Store, tu meta es nuestra meta.<small>© {new Date().getFullYear()} Samuel Store · Guatemala</small></p><a href="#pagos">Pedidos y pagos <ChevronRight size={14}/></a><span className="footer-demo"><Globe size={14}/> Interfaz de demostración</span></footer>
    <Dialog open={!!modal || !!product} onOpenChange={open => { if (!open) { setModal(null); setProduct(null) } }}><DialogContent className="store-dialog"><DialogHeader><span className="eyebrow">SAMUEL STORE · CUENTA SEGURA</span><DialogTitle>{product ? product.name : modal === 'login' ? 'Iniciar sesión' : modal === 'register' ? 'Forma parte de Samuel Store' : 'Tus pedidos, en un solo lugar'}</DialogTitle><DialogDescription>{product ? `${product.detail}. Consulta los precios disponibles en el catálogo.` : modal === 'orders' ? 'El historial de pedidos se habilitará en una siguiente fase.' : 'Accede a tu cuenta de Samuel Store.'}</DialogDescription></DialogHeader>{!product && modal !== 'orders' && <div className="auth-form">
      {!supabase && <p className="auth-message">Primero configura las variables de Supabase en Netlify.</p>}
      {modal === 'register' && <label>Nombre completo<input value={authName} onChange={e => setAuthName(e.target.value)} autoComplete="name" placeholder="Tu nombre" /></label>}
      <label>Correo electrónico<input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} autoComplete="email" placeholder="correo@ejemplo.com" /></label>
      <label>Contraseña<input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} autoComplete={modal === 'register' ? 'new-password' : 'current-password'} minLength={8} placeholder="Mínimo 8 caracteres" /></label>
      <button className="button" onClick={() => void submitAuth()}>{modal === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}</button>
      {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
      {user && <p>Sesión activa: {user.email}</p>}
    </div>}
    {!product && modal === null && isAdmin && <div className="admin-form"><h3>Administrar catálogo</h3><label>Nombre<input value={adminName} onChange={e => setAdminName(e.target.value)} /></label><label>Descripción<input value={adminDetail} onChange={e => setAdminDetail(e.target.value)} /></label><label>Categoría<select value={adminCategory} onChange={e => setAdminCategory(e.target.value as Category)}><option>Videojuegos</option><option>Streaming</option><option>Redes sociales</option><option>Reventa</option></select></label><label>Precio cliente (Q)<input type="number" min="0.01" step="0.01" value={adminPrice} onChange={e => setAdminPrice(e.target.value)} /></label><label>Precio revendedor (Q)<input type="number" min="0.01" step="0.01" value={adminResellerPrice} onChange={e => setAdminResellerPrice(e.target.value)} /></label><label>URL de imagen (opcional)<input value={adminImage} onChange={e => setAdminImage(e.target.value)} placeholder="https://..." /></label><button className="button" onClick={() => void saveProduct()}>Guardar producto</button>{authMessage && <p role="status">{authMessage}</p>}<h3>Productos actuales</h3>{dbProducts.map(p => <div key={p.id} className="admin-product-row"><span>{p.name} — Q {Number(p.price).toFixed(2)}</span><button className="button secondary" onClick={() => void deleteProduct(p.id)}>Eliminar</button></div>)}</div>}
    {product ? <><div className="modal-prices"><div>Cliente<strong>{money(product.price)}</strong></div><div>Revendedor<strong>{money(product.resellerPrice)}</strong></div></div><div className="modal-notice"><ShieldCheck size={22}/><p>Vista previa del producto. Las compras y los pagos están deshabilitados. No se crea ningún pedido.</p></div><a className="button" href="#pagos" onClick={() => setProduct(null)}>Conocer el proceso de pago <ArrowRight size={17}/></a></> : <div className="modal-notice">{modal === 'orders' ? <ShoppingBag size={28}/> : <ShieldCheck size={28}/>}<p>{modal === 'orders' ? (user ? 'El historial de pedidos se habilitará en una siguiente fase.' : 'Inicia sesión para consultar tus pedidos cuando el módulo esté habilitado.') : 'Crea tu cuenta o inicia sesión para acceder a tu espacio digital.'}</p></div>}<button className="button secondary" onClick={() => { setModal(null); setProduct(null) }}>Seguir explorando <ArrowRight size={16}/></button></DialogContent></Dialog>
  </div>
        }
