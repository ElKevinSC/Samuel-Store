import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { ArrowRight, ArrowLeft, Gamepad2, Menu, X, Upload, RefreshCw, LogOut } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ControllerArt } from '@/components/store/controller-art'
import { money, type Category } from '@/data/catalog'

export const Route = createFileRoute('/')({ component: Home })
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase = url && anonKey ? createClient(url, anonKey) : null

// LOGOS DE LOS JUEGOS
const GAME_LOGOS: Record<string, string> = {
  freefire:
    'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos/e39a86810c27bc4699a0e50628b2a402.jpg',
  bloodstrike:
    'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos/9476bb2a4d3910f6c63819d27abd24ef.jpg',
  roblox:
    'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos/070690595d2dc5c5b20eefbabe9f2748.jpg',
}

function getGameLogo(game: string): string | undefined {
  return GAME_LOGOS[game.toLowerCase().replace(/[\s_-]/g, '')]
}

type Product = { id: string; name: string; detail: string; game_name: string | null; category: Category; price: number; reseller_price: number; active: boolean }
type Bank = { id: string; bank_name: string; account_number: string; account_holder: string; active: boolean }
type Profile = { id: string; full_name: string; role: string; application_status: string }
type Order = { id: string; user_id: string; product_id: string | null; player_id: string; amount: number; reference_nc: string; deposit_date: string | null; receipt_path: string | null; status: string; created_at: string; products?: { detail?: string; game_name?: string } | null; profiles?: { full_name?: string } | null; receipt_signed_url?: string | null }

function Home() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState<'login' | 'register' | 'reseller_apply' | 'checkout' | 'my_orders' | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isReseller, setIsReseller] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [resAge, setResAge] = useState('')
  const [expectedSales, setExpectedSales] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  
const [cart, setCart] = useState<
  { product: Product; quantity: number }[]
>([])

  const [playerId, setPlayerId] = useState('')
  const [reference, setReference] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [gameName, setGameName] = useState('')
  const [packageName, setPackageName] = useState('')
  const [price, setPrice] = useState('')
  const [resellerPrice, setResellerPrice] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  async function refreshProducts() {
    if (!supabase) return
    const { data, error } = await supabase.from('products').select('id,name,detail,game_name,category,price,reseller_price,active').eq('active', true).order('created_at', { ascending: false })
    if (error) setMessage(`No se pudo cargar el catálogo: ${error.message}`)
    if (data) setProducts(data as Product[])
  }

  async function fetchMyOrders(uid: string) {
    if (!supabase) return
    const { data, error } = await supabase.from('orders').select('*, products(detail,game_name)').eq('user_id', uid).order('created_at', { ascending: false })
    if (!error && data) setMyOrders(data as Order[])
  }

  async function refreshAdmin() {
    if (!supabase) return
    const [p, b, o] = await Promise.all([
      supabase.from('profiles').select('id,full_name,role,application_status'),
      supabase.from('bank_accounts').select('id,bank_name,account_number,account_holder,active').eq('active', true),
      supabase.from('orders').select('*, products(detail,game_name), profiles(full_name)').order('created_at', { ascending: false })
    ])
    if (p.data) setProfiles(p.data as Profile[])
    if (b.data) setBanks(b.data as Bank[])
    if (o.data) {
      const list = await Promise.all((o.data as Order[]).map(async item => {
        if (!item.receipt_path || !supabase) return item
        const { data } = await supabase.storage.from('boletas').createSignedUrl(item.receipt_path, 600)
        return { ...item, receipt_signed_url: data?.signedUrl ?? null }
      }))
      setOrders(list)
    }
    
if (p.error || b.error || o.error) {
  console.error('Error en perfiles:', p.error?.message)
  console.error('Error en cuentas bancarias:', b.error?.message)
  console.error('Error en pedidos:', o.error?.message)

  setMessage(
    b.error
      ? `Error al cargar cuentas bancarias: ${b.error.message}`
      : p.error
        ? `Error en perfiles: ${p.error.message}`
        : `Error en pedidos: ${o.error?.message}`
  )
}
  

  async function loadUserRole(current: User) {
    if (!supabase) return
    const { data } = await supabase.from('profiles').select('role').eq('id', current.id).maybeSingle()
    const role = data?.role ?? 'customer'
    setIsAdmin(role === 'admin')
    setIsReseller(role === 'reseller' || role === 'admin')
    if (role === 'admin') await refreshAdmin()
    await fetchMyOrders(current.id)
  }

  useEffect(() => {
    if (!supabase) return
    let alive = true
    void refreshProducts()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const current = data.session?.user ?? null
      setUser(current)
      if (current) await loadUserRole(current)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = session?.user ?? null
      setUser(current)
      if (current) window.setTimeout(() => { void loadUserRole(current) }, 0)
      else {
        setIsAdmin(false)
        setIsReseller(false)
        setMyOrders([])
        setOrders([])
        setProfiles([])
      }
    })
    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function submitAuth() {
    if (!supabase) {
      setMessage('Faltan las variables de Supabase en Netlify.')
      return
    }
    setLoading(true)
    setMessage('')
    if (modal === 'register') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } }
      })
      setMessage(error ? error.message : 'Cuenta creada. Revisa tu correo para confirmar si se solicita.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage(error.message)
      else {
        setModal(null)
        setPassword('')
      }
    }
    setLoading(false)
  }

  async function applyReseller() {
    if (!supabase || !user) {
      setMessage('Inicia sesión para enviar la solicitud.')
      return
    }
    if (!fullName.trim() || Number(resAge) < 18 || Number(expectedSales) < 200) {
      setMessage('Completa el nombre, edad mínima de 18 años y ventas estimadas de Q200 o más.')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      age: Number(resAge),
      expected_sales: Number(expectedSales),
      application_status: 'pending'
    }).eq('id', user.id)
    setLoading(false)
    if (error) setMessage(`Error al enviar solicitud: ${error.message}`)
    else {
      setModal(null)
      setMessage('Solicitud enviada. El administrador la revisará.')
      await loadUserRole(user)
    }
  }

function addToCart(p: Product) {
  setCart(current => {
    const found = current.find(item => item.product.id === p.id)

    if (found) {
      return current.map(item =>
        item.product.id === p.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    }

    return [...current, { product: p, quantity: 1 }]
  })

  setMessage(`${p.detail || p.name} agregado al carrito.`)
}

function changeCartQuantity(productId: string, quantity: number) {
  if (quantity <= 0) {
    setCart(current =>
      current.filter(item => item.product.id !== productId)
    )
    return
  }

  setCart(current =>
    current.map(item =>
      item.product.id === productId
        ? { ...item, quantity }
        : item
    )
  )
}

  async function submitOrder() {
    if (!supabase || !user || !product) {
      setMessage('Inicia sesión y selecciona un producto.')
      return
    }
    if (!playerId.trim() || !reference.trim() || !depositDate || !receipt || Number(depositAmount) <= 0) {
      setMessage('Completa todos los campos y adjunta el comprobante.')
      return
    }
    if (receipt.size > 5 * 1024 * 1024) {
      setMessage('El comprobante debe pesar máximo 5 MB.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(receipt.type)) {
      setMessage('Usa JPG, PNG, WEBP o PDF.')
      return
    }
    setLoading(true)
    setMessage('Subiendo comprobante...')
    const ext = receipt.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('boletas').upload(path, receipt, {
      contentType: receipt.type,
      upsert: false
    })
    if (uploadError) {
      setLoading(false)
      setMessage(`Error al subir boleta: ${uploadError.message}`)
      return
    }
    const { error } = await supabase.from('orders').insert({
      user_id: user.id,
      product_id: product.id,
      player_id: playerId.trim(),
      amount: Number(depositAmount),
      reference_nc: reference.trim(),
      deposit_date: depositDate,
      receipt_path: path,
      status: 'pending'
    })
    if (error) {
      await supabase.storage.from('boletas').remove([path])
      setLoading(false)
      setMessage(`Error al guardar pedido: ${error.message}. Verifica que orders tenga product_id y su relación con products.`)
      return
    }
    setLoading(false)
    setModal(null)
    setMessage('Pedido enviado correctamente.')
    await fetchMyOrders(user.id)
    setPlayerId('')
    setReference('')
    setDepositAmount('')
    setDepositDate('')
    setReceipt(null)
  }

  async function updateOrder(id: string, status: 'completed' | 'rejected') {
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) setMessage(`No se pudo actualizar el pedido: ${error.message}`)
    else await refreshAdmin()
  }

  async function approveReseller(id: string, status: 'approved' | 'rejected') {
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('profiles').update({
      role: status === 'approved' ? 'reseller' : 'customer',
      application_status: status
    }).eq('id', id)
    if (error) setMessage(`No se pudo actualizar la solicitud: ${error.message}`)
    else await refreshAdmin()
  }

  async function saveProduct() {
    if (!supabase || !isAdmin) return
    if (!gameName.trim() || !packageName.trim() || Number(price) <= 0) {
      setMessage('Escribe juego, paquete y precio válido.')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('products').insert({
      name: packageName.trim(),
      detail: packageName.trim(),
      game_name: gameName.trim(),
      category: 'Videojuegos',
      price: Number(price),
      reseller_price: Number(resellerPrice || price),
      active: true
    })
    setLoading(false)
    if (error) setMessage(`Error al guardar producto: ${error.message}`)
    else {
      setMessage('Producto guardado.')
      setGameName('')
      setPackageName('')
      setPrice('')
      setResellerPrice('')
      await refreshProducts()
    }
  }

  async function saveBank() {
    if (!supabase || !isAdmin) return
    if (!bankName.trim() || !bankAccount.trim()) {
      setMessage('Completa banco y número de cuenta.')
      return
    }
    const { error } = await supabase.from('bank_accounts').insert({
      bank_name: bankName.trim(),
      account_number: bankAccount.trim(),
      account_holder: bankHolder.trim(),
      active: true
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

  const games = useMemo(() => Array.from(new Set(products.map(p => p.game_name || 'Otros'))), [products])
  const gameProducts = useMemo(() => products.filter(p => (p.game_name || 'Otros') === selectedGame), [products, selectedGame])
  const pendingResellers = profiles.filter(p => p.application_status === 'pending')
  const pendingOrders = orders.filter(o => o.status === 'pending')

  if (!supabase) {
    return (
      <div className="storefront wrap" style={{ padding: 32 }}>
        <h1>Samuel Store</h1>
        <p>Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno de Netlify y vuelve a publicar.</p>
      </div>
    )
  }

  return (
    <div className="storefront">
      <header className="header wrap">
        <a className="brand" href="#inicio">
          <img className="brand-logo" src="/images/samuel-store-logo.jpg" alt="Samuel Store" />
        </a>
        <nav className={menu ? 'navigation open' : 'navigation'}>
          <a className="active" href="#inicio" onClick={() => setMenu(false)}>Inicio</a>
          <a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a>
          <button onClick={() => { setModal(user ? 'my_orders' : 'login'); setMenu(false) }}>Mis pedidos</button>
        </nav>
        <div className="account">
          {user ? (
            <>
              <span className="login">{user.email}</span>
              {isAdmin && <button className="button small" onClick={() => document.getElementById('admin-panel')?.scrollIntoView({ behavior: 'smooth' })}>Administrar</button>}
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

      <main>
        <section className="hero wrap" id="inicio">
          <div className="hero-copy">
            <h1>Tu juego.<br />Tu mundo.<br /><span>Tu siguiente nivel.</span></h1>
            <p className="slogan">En Samuel Store, tu meta es nuestra meta.</p>
            <div className="hero-actions">
              <a className="button" href="#catalogo">Explorar catálogo <ArrowRight size={18} /></a>
            </div>
          </div>
          <div className="hero-art"><ControllerArt /></div>
        </section>

        <section className="section catalog wrap" id="catalogo">
          <div className="section-heading">
            <div>
              <h2>Videojuegos<span className="blue-text">.</span></h2>
              {!isReseller && user && (
                <p style={{ fontSize: 12, color: '#f06675' }}>
                  <button onClick={() => { setMessage(''); setModal('reseller_apply') }} style={{ textDecoration: 'underline' }}>
                    Solicita ser revendedor aquí
                  </button>
                </p>
              )}
            </div>
            {selectedGame && <button className="button secondary small" onClick={() => setSelectedGame(null)}><ArrowLeft size={16} /> Volver a juegos</button>}
            <button className="button secondary small" onClick={() => { void refreshProducts() }}><RefreshCw size={15} /></button>
          </div>

          {!selectedGame && (
            <div className="category-grid">
              {games.length === 0 ? (
                <p style={{ color: 'gray' }}>Todavía no hay juegos disponibles.</p>
              ) : (
                games.map(game => {
                  const logo = getGameLogo(game)
                  return (
                    <button key={game} className="category-card" onClick={() => setSelectedGame(game)}>
                      <span
                        className="category-icon"
                        style={{
                          width: 76,
                          height: 76,
                          overflow: 'hidden',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          borderRadius: 12
                        }}
                      >
                        {logo ? (
                          <img
                            src={logo}
                            alt={`Logo de ${game}`}
                            loading="lazy"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              borderRadius: 12
                            }}
                          />
                        ) : (
                          <Gamepad2 size={27} />
                        )}
                      </span>
                      <h3>{game}</h3>
                      <p>Ver paquetes de recarga</p>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {selectedGame && (
            <div className="product-grid">
              {gameProducts.length === 0 ? (
                <p>No hay paquetes para este juego.</p>
              ) : (
                gameProducts.map(p => {
                  const displayPrice = Number(isReseller ? p.reseller_price : p.price)
                  return (
                    <article className="product-card" key={p.id}>
                      <div className="product-info">
                        <h3>{p.detail || p.name}</h3>
                        <div className="price-row">
                          <div>
                            <span className="price-caption">Precio</span>
                            <strong>{money(displayPrice)}</strong>
                          </div>
                          <button className="button" onClick={() => {
                            if (!user) {
                              setModal('login')
                              return
                            }
                            setProduct(p)
                            setDepositAmount(String(displayPrice))
                            setMessage('')
                            setModal('checkout')
                          }}>Comprar</button>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="section wrap" id="admin-panel" style={{ borderTop: '2px solid #00a3ff', marginTop: 50, paddingBottom: 50 }}>
            <h2>Panel de administración</h2>
            <div className="admin-form" style={{ marginTop: 20 }}>
              <h3>Solicitudes de revendedor pendientes</h3>
              {pendingResellers.map(p => (
                <div key={p.id} className="admin-product-row" style={{ backgroundColor: '#222', padding: 10, margin: '5px 0' }}>
                  <span><strong>{p.full_name || 'Usuario'}</strong> quiere ser revendedor.</span>
                  <div>
                    <button className="button small" onClick={() => { void approveReseller(p.id, 'approved') }}>Aprobar</button>
                    <button className="button small" style={{ marginLeft: 5 }} onClick={() => { void approveReseller(p.id, 'rejected') }}>Rechazar</button>
                  </div>
                </div>
              ))}
              {pendingResellers.length === 0 && <p>No hay solicitudes pendientes.</p>}
            </div>

            <div className="admin-form" style={{ marginTop: 20 }}>
              <h3>Pedidos pendientes</h3>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {pendingOrders.map(o => (
                  <div key={o.id} className="admin-product-row" style={{ backgroundColor: '#222', padding: 10, margin: '5px 0', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <p><strong>Cliente:</strong> {o.profiles?.full_name || o.user_id} | <strong>Juego:</strong> {o.products?.game_name || '—'} - {o.products?.detail || '—'}</p>
                    <p><strong>ID jugador:</strong> {o.player_id} | <strong>Monto:</strong> Q{o.amount} | <strong>NC:</strong> {o.reference_nc}</p>
                    <p><strong>Fecha depósito:</strong> {o.deposit_date || '—'}</p>
                    {o.receipt_signed_url ? (
                      <a href={o.receipt_signed_url} target="_blank" rel="noreferrer" style={{ color: '#00a3ff', textDecoration: 'underline' }}>Ver comprobante</a>
                    ) : <p>No se pudo crear enlace para la boleta.</p>}
                    <div style={{ marginTop: 10 }}>
                      <button className="button small" onClick={() => { void updateOrder(o.id, 'completed') }}>Aprobar y completar</button>
                      <button className="button small" style={{ marginLeft: 5 }} onClick={() => { void updateOrder(o.id, 'rejected') }}>Rechazar</button>
                    </div>
                  </div>
                ))}
                {pendingOrders.length === 0 && <p>No hay pedidos pendientes.</p>}
              </div>
              <button className="button secondary small" onClick={() => { void refreshAdmin() }}><RefreshCw size={14} /> Actualizar</button>
            </div>

            <div className="admin-form" style={{ marginTop: 20 }}>
              <h3>Crear juego / paquete</h3>
              <label>Categoría principal<select value="Videojuegos" disabled><option>Videojuegos</option></select></label>
              <input placeholder="Nombre del juego (Ej. Free Fire)" value={gameName} onChange={e => setGameName(e.target.value)} />
              <input placeholder="Nombre del paquete (Ej. 1000 Diamantes)" value={packageName} onChange={e => setPackageName(e.target.value)} />
              <input type="number" min="0.01" step="0.01" placeholder="Precio cliente (Q)" value={price} onChange={e => setPrice(e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Precio revendedor (Q)" value={resellerPrice} onChange={e => setResellerPrice(e.target.value)} />
              <button className="button" disabled={loading} onClick={() => { void saveProduct() }}>Guardar producto</button>
            </div>

            <div className="admin-form" style={{ marginTop: 20 }}>
              <h3>Mis cuentas bancarias</h3>
              <input placeholder="Banco (Ej. Banrural)" value={bankName} onChange={e => setBankName(e.target.value)} />
              <input placeholder="Número de cuenta" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
              <input placeholder="Titular" value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
              <button className="button" disabled={loading} onClick={() => { void saveBank() }}>Guardar cuenta</button>
              <ul>{banks.map(b => <li key={b.id}>{b.bank_name} — {b.account_number} ({b.account_holder})</li>)}</ul>
            </div>
            {message && <p role="status" style={{ color: '#00a3ff', marginTop: 12 }}>{message}</p>}
          </section>
        )}
      </main>

      <Dialog open={!!modal} onOpenChange={open => { if (!open) { setModal(null); setMessage('') } }}>
        <DialogContent className="store-dialog">
          {(modal === 'login' || modal === 'register') && (
            <>
              <DialogHeader><DialogTitle>{modal === 'login' ? 'Iniciar sesión' : 'Registrarse'}</DialogTitle></DialogHeader>
              <div className="auth-form">
                {modal === 'register' && <label>Nombre completo<input value={fullName} onChange={e => setFullName(e.target.value)} /></label>}
                <label>Correo<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
                <label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
                <button className="button" disabled={loading} onClick={() => { void submitAuth() }}>{loading ? 'Procesando...' : modal === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
                {message && <p role="status">{message}</p>}
              </div>
            </>
          )}

          {modal === 'reseller_apply' && (
            <>
              <DialogHeader><DialogTitle>Solicitar ser revendedor</DialogTitle><DialogDescription>Ventas estimadas mínimas: Q200 al mes.</DialogDescription></DialogHeader>
              <div className="auth-form">
                <label>Nombre completo<input value={fullName} onChange={e => setFullName(e.target.value)} /></label>
                <label>Edad<input type="number" min="18" value={resAge} onChange={e => setResAge(e.target.value)} /></label>
                <label>Ventas estimadas al mes (Q)<input type="number" min="200" value={expectedSales} onChange={e => setExpectedSales(e.target.value)} /></label>
                <button className="button" disabled={loading} onClick={() => { void applyReseller() }}>Enviar solicitud</button>
                {message && <p role="status">{message}</p>}
              </div>
            </>
          )}

          {modal === 'my_orders' && (
            <>
              <DialogHeader><DialogTitle>Mis pedidos</DialogTitle></DialogHeader>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {myOrders.map(o => (
                  <div key={o.id} style={{ borderBottom: '1px solid #333', padding: '10px 0' }}>
                    <p><strong>{o.products?.game_name || 'Producto'} — {o.products?.detail || 'Paquete'}</strong></p>
                    <p>Monto: Q{o.amount} | ID jugador: {o.player_id}</p>
                    <p>Estado: <strong style={{ color: o.status === 'completed' ? 'green' : o.status === 'rejected' ? 'red' : 'orange' }}>
                      {o.status === 'completed' ? 'Completado' : o.status === 'rejected' ? 'Rechazado' : o.status === 'payment_confirmed' ? 'Pago confirmado' : o.status === 'processing' ? 'En proceso' : 'En revisión'}
                    </strong></p>
                  </div>
                ))}
                {myOrders.length === 0 && <p>No tienes pedidos aún.</p>}
              </div>
              <button className="button secondary small" onClick={() => { if (user) void fetchMyOrders(user.id) }}><RefreshCw size={14} /> Actualizar</button>
            </>
          )}

          {modal === 'checkout' && product && (
            <>
              <DialogHeader><DialogTitle>Completar pedido</DialogTitle><DialogDescription>Deposita el monto y adjunta tu comprobante.</DialogDescription></DialogHeader>
              <div className="auth-form">
                <p>Producto: <strong>{product.detail || product.name}</strong> — <strong>{money(Number(isReseller ? product.reseller_price : product.price))}</strong></p>
                <label>ID de jugador<input value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="Ej. 12345678" /></label>
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
                <label>Referencia NC<input value={reference} onChange={e => setReference(e.target.value)} /></label>
                <label>Monto depositado (Q)<input type="number" min="0.01" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} /></label>
                <label>Fecha del depósito<input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} /></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#222', padding: 10, borderRadius: 5 }}>
                  <Upload size={20} />{receipt ? receipt.name : 'Seleccionar comprobante'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
                </label>
                <button className="button" disabled={loading} onClick={() => { void submitOrder() }}>{loading ? 'Enviando...' : 'Confirmar pedido'}</button>
                {message && <p role="status" style={{ color: '#00a3ff' }}>{message}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
              }
