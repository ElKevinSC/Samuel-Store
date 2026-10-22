import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { ArrowUpRight, ArrowRight, Gamepad2, Zap, ShieldCheck, Headphones, Play, Users, ShoppingBag, Search, Menu, X, ChevronRight, Landmark, Check, Globe, Sparkles, Layers, ArrowLeft, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ControllerArt } from '@/components/store/controller-art'
import { money, type Category, type Product } from '@/data/catalog'

export const Route = createFileRoute('/')({ component: Home })
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

type DbProduct = { id: string; name: string; detail: string; game_name?: string | null; category: Category; price: number; reseller_price: number; image_url?: string | null; active: boolean; label?: string | null; art?: string | null }

const categories = [
  { name: 'Videojuegos' as Category, text: 'Lleva tu juego al siguiente nivel', icon: Gamepad2, style: 'gaming' },
  { name: 'Streaming' as Category, text: 'Tus series, música y más', icon: Play, style: 'streaming' },
  { name: 'Redes sociales' as Category, text: 'Haz crecer tu presencia digital', icon: Users, style: 'networks' },
  { name: 'Reventa' as Category, text: 'Más oportunidades para ti', icon: Layers, style: 'resale' },
]

function Home() {
  const [category, setCategory] = useState<Category>('Todos')
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState<'login' | 'register' | 'reseller_apply' | 'checkout' | 'my_orders' | null>(null)
  
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isReseller, setIsReseller] = useState(false) 

  const [dbProducts, setDbProducts] = useState<DbProduct[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [myOrders, setMyOrders] = useState<any[]>([])
  
  // Auth Form
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  // Reseller Form
  const [resName, setResName] = useState('')
  const [resAge, setResAge] = useState('')
  const [resExpected, setResExpected] = useState('')

  // Checkout Form
  const [checkoutProduct, setCheckoutProduct] = useState<any>(null)
  const [playerId, setPlayerId] = useState('')
  const [ncRef, setNcRef] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // Admin Form
  const [adminGameName, setAdminGameName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminDetail, setAdminDetail] = useState('')
  const [adminPrice, setAdminPrice] = useState('')
  const [adminResellerPrice, setAdminResellerPrice] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const fetchUserRole = async (currentUser: User) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
      if (!alive) return
      if (data) {
        setUserProfile(data)
        setIsAdmin(data.role === 'admin')
        setIsReseller(data.role === 'reseller' || data.role === 'admin')
        if (data.role === 'admin') { void refreshAdminData(); }
        void fetchMyOrders(currentUser.id);
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) fetchUserRole(sessionUser)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) fetchUserRole(sessionUser)
      else { setIsAdmin(false); setIsReseller(false); setUserProfile(null); setMyOrders([]); }
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  async function refreshAdminData() {
    if (!supabase) return
    const { data: users } = await supabase.from('profiles').select('id, full_name, role, application_status')
    if (users) setAllUsers(users)
    const { data: banksData } = await supabase.from('bank_accounts').select('*').eq('active', true)
    if (banksData) setBanks(banksData)
    const { data: ordersData } = await supabase.from('orders').select('*, products(detail, game_name), profiles(full_name)').order('created_at', { ascending: false })
    if (ordersData) setAllOrders(ordersData)
  }

  async function fetchMyOrders(userId: string) {
    if (!supabase) return
    const { data } = await supabase.from('orders').select('*, products(detail, game_name)').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setMyOrders(data)
  }

  async function refreshProducts() {
    if (!supabase) return
    const { data } = await supabase.from('products').select('*').eq('active', true)
    if (data) setDbProducts(data as DbProduct[])
  }
  
  useEffect(() => { if (supabase) { void refreshProducts(); } }, [])

  // --- ACCIONES ---
  async function submitAuth() {
    if (!supabase) return
    setAuthMessage('')
    if (modal === 'register') {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } })
      setAuthMessage(error ? error.message : 'Revisa tu correo para confirmar.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) setAuthMessage(error.message); else setModal(null);
    }
  }

  async function applyReseller() {
    if (!supabase || !user) return
    const { error } = await supabase.from('profiles').update({
      full_name: resName, age: Number(resAge), expected_sales: Number(resExpected), application_status: 'pending'
    }).eq('id', user.id)
    if (error) setAuthMessage(error.message)
    else { setAuthMessage('Solicitud enviada. Espera la aprobación.'); setTimeout(() => setModal(null), 2000); }
  }

  async function submitOrder() {
    if (!supabase || !user || !checkoutProduct || !receiptFile) { alert('Faltan datos o comprobante'); return }
    setAuthMessage('Subiendo comprobante...')
    
    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('boletas').upload(fileName, receiptFile)
    
    if (uploadError) { setAuthMessage('Error al subir foto: ' + uploadError.message); return }
    const { data: urlData } = supabase.storage.from('boletas').getPublicUrl(fileName)

    const { error } = await supabase.from('orders').insert({
      user_id: user.id, product_id: checkoutProduct.id, player_id: playerId, amount: Number(depositAmount), reference_nc: ncRef, date: new Date(depositDate), receipt_url: urlData.publicUrl, status: 'pending'
    })

    if (error) setAuthMessage('Error al crear pedido: ' + error.message)
    else { setAuthMessage('¡Pedido enviado! Revisaremos tu pago pronto.'); setTimeout(() => { setModal(null); fetchMyOrders(user.id); }, 2500); }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!supabase || !isAdmin) return
    await supabase.from('orders').update({ status }).eq('id', orderId)
    void refreshAdminData()
  }

  async function approveReseller(userId: string, status: string) {
    if (!supabase || !isAdmin) return
    await supabase.from('profiles').update({ role: status === 'approved' ? 'reseller' : 'customer', application_status: status }).eq('id', userId)
    void refreshAdminData()
  }

  async function saveProduct() {
    if (!supabase || !isAdmin) return
    await supabase.from('products').insert({ name: adminName, detail: adminDetail, game_name: adminGameName, category: 'Videojuegos', price: Number(adminPrice), reseller_price: Number(adminResellerPrice), active: true })
    void refreshProducts(); setAdminName(''); setAdminDetail(''); setAdminPrice('');
  }

  async function saveBank() {
    if (!supabase || !isAdmin) return
    await supabase.from('bank_accounts').insert({ bank_name: bankName, account_number: bankAccount, account_holder: bankHolder })
    void refreshAdminData(); setBankName(''); setBankAccount(''); setBankHolder('');
  }

  const availableGames = Array.from(new Set(dbProducts.filter(p => category === 'Todos' || p.category === category).map(p => p.game_name || 'Otros')))
  const filteredProducts = dbProducts.filter(p => {
    if (category !== 'Todos' && p.category !== category) return false;
    if (selectedGame && (p.game_name || 'Otros') !== selectedGame) return false;
    return true;
  })

  return <div className="storefront">
    <header className="header wrap">
      <a className="brand" href="#inicio"><img className="brand-logo" src="/images/samuel-store-logo.jpg" alt="Samuel Store"/></a>
      <nav className={menu ? 'navigation open' : 'navigation'}>
        <a className="active" href="#inicio" onClick={() => setMenu(false)}>Inicio</a>
        <a href="#categorias" onClick={() => setMenu(false)}>Categorías</a>
        <a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a>
        <button onClick={() => { user ? setModal('my_orders') : setModal('login'); setMenu(false) }}>Mis pedidos</button>
      </nav>
      <div className="account">
        {user ? <>
          <span className="login">{user.email}</span>
          {isAdmin && <button className="button small" style={{ backgroundColor: '#00a3ff' }} onClick={() => document.getElementById('admin-panel')?.scrollIntoView({ behavior: 'smooth' })}>Administrar</button>}
          <button className="button small" onClick={() => supabase?.auth.signOut()}>Salir</button>
        </> : <>
          <button className="login" onClick={() => { setAuthMessage(''); setModal('login') }}>Iniciar sesión</button>
          <button className="button small" onClick={() => { setAuthMessage(''); setModal('register') }}>Registrarse</button>
        </>}
        <button className="mobile-menu" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
      </div>
    </header>

    <main>
      <section className="hero wrap" id="inicio">
        <div className="hero-copy">
          <h1>Tu juego.<br/>Tu mundo.<br/><span>Tu siguiente nivel.</span></h1>
          <p className="slogan">En Samuel Store, tu meta es nuestra meta.</p>
          <div className="hero-actions"><a className="button" href="#catalogo">Explorar catálogo <ArrowRight size={18}/></a></div>
        </div>
        <div className="hero-art"><ControllerArt/></div>
      </section>

      <section className="section wrap" id="categorias">
        <div className="category-grid">
          {categories.map(({name, text, icon: Icon, style}) => 
            <button key={name} className={`category-card ${style} ${category === name ? 'selected' : ''}`} onClick={() => { setCategory(name); setSelectedGame(null); document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }) }}>
              <span className="category-icon"><Icon size={27}/></span><h3>{name}</h3><p>{text}</p>
            </button>
          )}
        </div>
      </section>

      <section className="section catalog wrap" id="catalogo">
        <div className="section-heading">
          <div>
            <h2>{selectedGame ? `Paquetes para ${selectedGame}` : 'Catálogo'}<span className="blue-text">.</span></h2>
            {!isReseller && user && <p style={{fontSize: '12px', color: '#f06675'}}>¿Quieres ganar más? <span style={{textDecoration: 'underline', cursor: 'pointer'}} onClick={() => setModal('reseller_apply')}>Solicita ser revendedor aquí</span></p>}
          </div>
          {selectedGame && <button className="button secondary small" onClick={() => setSelectedGame(null)}><ArrowLeft size={16}/> Volver</button>}
        </div>
        
        {!selectedGame && (
          <div className="category-grid">
            {availableGames.map(game => (
              <button key={game} className="category-card" onClick={() => setSelectedGame(game)}>
                <span className="category-icon"><Gamepad2 size={27}/></span><h3>{game}</h3><p>Ver paquetes</p>
              </button>
            ))}
          </div>
        )}

        {selectedGame && (
          <div className="product-grid">
            {filteredProducts.map(p => {
              const displayPrice = isReseller ? p.reseller_price : p.price;
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-info">
                    <h3>{p.detail}</h3>
                    <div className="price-row">
                      <div><span className="price-caption">Precio</span><strong>{money(displayPrice)}</strong></div>
                      <button className="button" onClick={() => { if(!user) { setModal('login'); return; } setCheckoutProduct({...p, price: displayPrice}); setModal('checkout') }}>Comprar</button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* PANEL DE ADMIN */}
      {isAdmin && (
        <section className="section wrap" id="admin-panel" style={{ borderTop: '2px solid #00a3ff', marginTop: '50px' }}>
          <h2>Panel de Administración</h2>
          
          {/* Pedidos Pendientes */}
          <div className="admin-form" style={{ marginTop: '20px' }}>
            <h3>Pedidos Pendientes de Aprobación</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {allOrders.filter(o => o.status === 'pending').map(o => (
                <div key={o.id} className="admin-product-row" style={{ backgroundColor: '#222', padding: '10px', margin: '5px 0', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <p><strong>Cliente:</strong> {o.profiles?.full_name} | <strong>Juego:</strong> {o.products?.game_name} - {o.products?.detail}</p>
                  <p><strong>ID Jugador:</strong> {o.player_id} | <strong>Monto:</strong> Q{o.amount} | <strong>NC:</strong> {o.reference_nc}</p>
                  <a href={o.receipt_url} target="_blank" rel="noreferrer" style={{color: '#00a3ff', textDecoration: 'underline'}}>Ver Boleta</a>
                  <div style={{ marginTop: '10px' }}>
                    <button className="button small" style={{backgroundColor: 'green'}} onClick={() => updateOrderStatus(o.id, 'completed')}>Aprobar Pago</button>
                    <button className="button small" style={{backgroundColor: 'red', marginLeft: '5px'}} onClick={() => updateOrderStatus(o.id, 'rejected')}>Rechazar</button>
                  </div>
                </div>
              ))}
              {allOrders.filter(o => o.status === 'pending').length === 0 && <p>No hay pedidos pendientes.</p>}
            </div>
          </div>

          {/* Solicitudes de Revendedor */}
          <div className="admin-form" style={{ marginTop: '20px' }}>
            <h3>Solicitudes de Revendedor</h3>
            {allUsers.filter(u => u.application_status === 'pending').map(u => (
              <div key={u.id} className="admin-product-row" style={{ backgroundColor: '#222', padding: '10px', margin: '5px 0' }}>
                <span>{u.full_name}</span>
                <div>
                  <button className="button small" style={{backgroundColor: 'green'}} onClick={() => approveReseller(u.id, 'approved')}>Aprobar</button>
                  <button className="button small" style={{backgroundColor: 'red', marginLeft: '5px'}} onClick={() => approveReseller(u.id, 'rejected')}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>

          {/* Cuentas de Banco */}
          <div className="admin-form" style={{ marginTop: '20px' }}>
            <h3>Mis Cuentas Bancarias</h3>
            <input placeholder="Banco" value={bankName} onChange={e => setBankName(e.target.value)} />
            <input placeholder="Número de Cuenta" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
            <input placeholder="Titular" value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
            <button className="button" onClick={saveBank}>Guardar Cuenta</button>
            <ul>{banks.map(b => <li key={b.id}>{b.bank_name} - {b.account_number}</li>)}</ul>
          </div>

          {/* Crear Juego / Producto */}
          <div className="admin-form" style={{ marginTop: '20px' }}>
            <h3>Crear Juego / Paquete</h3>
            <input placeholder="Nombre del Juego (Ej. Free Fire)" value={adminGameName} onChange={e => setAdminGameName(e.target.value)} />
            <input placeholder="Paquete (Ej. 1000 Diamantes)" value={adminName} onChange={e => {setAdminName(e.target.value); setAdminDetail(e.target.value)}} />
            <input type="number" placeholder="Precio Cliente" value={adminPrice} onChange={e => setAdminPrice(e.target.value)} />
            <input type="number" placeholder="Precio Revendedor" value={adminResellerPrice} onChange={e => setAdminResellerPrice(e.target.value)} />
            <button className="button" onClick={saveProduct}>Guardar Producto</button>
          </div>
        </section>
      )}
    </main>

    <Dialog open={!!modal} onOpenChange={open => { if (!open) setModal(null) }}>
      <DialogContent className="store-dialog">
        
        {(modal === 'login' || modal === 'register') && <>
          <DialogHeader><DialogTitle>{modal === 'login' ? 'Iniciar sesión' : 'Registrarse'}</DialogTitle></DialogHeader>
          <div className="auth-form">
            {modal === 'register' && <label>Nombre<input value={authName} onChange={e => setAuthName(e.target.value)} /></label>}
            <label>Correo<input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></label>
            <label>Contraseña<input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} /></label>
            <button className="button" onClick={submitAuth}>{modal === 'login' ? 'Entrar' : 'Crear Cuenta'}</button>
            {authMessage && <p style={{color: 'red'}}>{authMessage}</p>}
          </div>
        </>}

        {modal === 'reseller_apply' && <>
          <DialogHeader><DialogTitle>Solicitar ser Revendedor</DialogTitle><DialogDescription>Requisito: Vender al menos Q200 mensuales.</DialogDescription></DialogHeader>
          <div className="auth-form">
            <label>Nombre Completo<input value={resName} onChange={e => setResName(e.target.value)} /></label>
            <label>Edad<input type="number" value={resAge} onChange={e => setResAge(e.target.value)} /></label>
            <label>Ventas estimadas al mes (Q)<input type="number" value={resExpected} onChange={e => setResExpected(e.target.value)} /></label>
            <button className="button" onClick={applyReseller}>Enviar Solicitud</button>
            {authMessage && <p>{authMessage}</p>}
          </div>
        </>}

        {modal === 'my_orders' && <>
          <DialogHeader><DialogTitle>Mis Pedidos</DialogTitle></DialogHeader>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {myOrders.map(o => (
              <div key={o.id} style={{ borderBottom: '1px solid #333', padding: '10px 0' }}>
                <p><strong>{o.products?.game_name} - {o.products?.detail}</strong></p>
                <p>Monto: Q{o.amount} | ID: {o.player_id}</p>
                <p>Estado: <strong style={{ color: o.status === 'completed' ? 'green' : o.status === 'rejected' ? 'red' : 'orange' }}>{o.status === 'completed' ? 'Completado' : o.status === 'rejected' ? 'Rechazado' : 'En Revisión'}</strong></p>
              </div>
            ))}
            {myOrders.length === 0 && <p>No tienes pedidos aún.</p>}
          </div>
        </>}

        {modal === 'checkout' && checkoutProduct && <>
          <DialogHeader><DialogTitle>Completar Pedido</DialogTitle></DialogHeader>
          <div className="auth-form">
            <p>Comprando: <strong>{checkoutProduct.detail}</strong> por <strong>{money(checkoutProduct.price)}</strong></p>
            <label>Tu ID de Jugador<input value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="Ej. 12345678" /></label>
            
            <div style={{ backgroundColor: '#003366', padding: '15px', borderRadius: '8px', margin: '10px 0' }}>
              <h4 style={{margin: '0 0 10px 0'}}>Datos para depositar:</h4>
              {banks.map(b => (
                <div key={b.id} style={{ marginBottom: '10px' }}>
                  <p style={{ margin: '2px 0' }}>🏦 Banco: <strong>{b.bank_name}</strong></p>
                  <p style={{ margin: '2px 0' }}>💳 Cuenta: <strong>{b.account_number}</strong></p>
                  <p style={{ margin: '2px 0' }}>👤 Titular: <strong>{b.account_holder}</strong></p>
                </div>
              ))}
              <p style={{ fontSize: '11px', color: '#ffcc00' }}>⚠️ Deposita el monto EXACTO y sube tu comprobante.</p>
            </div>

            <label>Número de Referencia (NC)<input value={ncRef} onChange={e => setNcRef(e.target.value)} /></label>
            <label>Monto Depositado (Q)<input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} /></label>
            <label>Fecha del depósito<input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} /></label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#222', padding: '10px', borderRadius: '5px' }}>
              <Upload size={20}/> {receiptFile ? receiptFile.name : 'Subir foto del comprobante'}
              <input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            </label>

            <button className="button" style={{ marginTop: '15px' }} onClick={submitOrder}>Confirmar Pedido</button>
            {authMessage && <p style={{color: '#00a3ff'}}>{authMessage}</p>}
          </div>
        </>}

      </DialogContent>
    </Dialog>
  </div>
}
