import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { ArrowRight, ArrowLeft, Gamepad2, Menu, X, Upload, RefreshCw, LogOut, ShoppingCart } from 'lucide-react'
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
type Order = { id: string; user_id: string; product_id: string | null; player_id: string; amount: number; reference_nc: string; deposit_date: string | null; receipt_path: string | null; status: string; created_at: string; products?: { detail?: string; game_name?: string } | null; order_items?: { game_name: string; product_name: string; quantity: number; unit_price: number; line_total: number }[] | null; profiles?: { full_name?: string } | null; receipt_signed_url?: string | null }

function Home() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState<'login' | 'register' | 'reseller_apply' | 'checkout'| 'my_orders' | 'terms' | 'order_done' | 'legal' | 'privacy' | 'user_orders' | null>(null)
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
  const [acceptTerms, setAcceptTerms] = useState(false)
const [waLink, setWaLink] = useState('')
  const [toast, setToast] = useState('')
  const [cookieOk, setCookieOk] = useState(true)
  const [historyUser, setHistoryUser] = useState<string | null>(null)
  useEffect(() => {
    try { if (!localStorage.getItem('cookies_ok')) setCookieOk(false) } catch { /* nada */ }
  }, [])
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
  async function refreshBanks() {
    if (!supabase) return

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('id,bank_name,account_number,account_holder,active')
      .eq('active', true)

    if (error) {
      console.error('Error al cargar cuentas:', error.message)
      setMessage(`Error al cargar cuentas bancarias: ${error.message}`)
      return
    }

    setBanks((data ?? []) as Bank[])
  }
  async function fetchMyOrders(uid: string) {
    if (!supabase) return
const { data, error } = await supabase.from('orders').select('*, products(detail,game_name), order_items(game_name,product_name,quantity,unit_price,line_total)').eq('user_id', uid).order('created_at', { ascending: false })
    if (!error && data) setMyOrders(data as Order[])
  }

  async function refreshAdmin() {
    if (!supabase) return
    const [p, b, o] = await Promise.all([
      supabase.from('profiles').select('id,full_name,role,application_status'),
      supabase.from('bank_accounts').select('id,bank_name,account_number,account_holder,active')
        .eq('active', true),
supabase.from('orders').select('*, products(detail,game_name), order_items(game_name,product_name,quantity,unit_price,line_total), profiles(full_name)').order('created_at', { ascending: false })
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
    void refreshBanks()
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

function showToast(text: string) {
  setToast(text)
  window.setTimeout(() => setToast(''), 2500)
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

  showToast(`${p.detail || p.name} agregado al carrito`)
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
    if (!supabase || !user || cart.length === 0) {
      setMessage('Inicia sesión y agrega paquetes al carrito.')
      return
    }
    if (!playerId.trim() || !reference.trim() || !depositDate || !receipt || Number(depositAmount) <= 0) {
      setMessage('Completa todos los campos y adjunta el comprobante.')
      return
    }
    if (!acceptTerms) {
  setMessage('Debes aceptar los términos y condiciones.')
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
    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_player_id: playerId.trim(),
      p_reference_nc: reference.trim(),
      p_deposit_date: depositDate,
      p_receipt_path: path,
      p_amount: Number(depositAmount),
      p_items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity }))
    })
    if (error) {
      await supabase.storage.from('boletas').remove([path])
      setLoading(false)
      setMessage(`No se pudo guardar el pedido: ${error.message}`)
      return
    }
    setLoading(false)
    setModal(null)
    const lines = cart.map(item => `• ${item.quantity} x ${item.product.detail || item.product.name}`).join('\n')
const text = `Hola Samuel Store, acabo de hacer un pedido.\n\nPedido: ${String(orderId ?? '').slice(0, 8)}\nJuego: ${cart[0].product.game_name || 'Otros'}\nID de jugador: ${playerId.trim()}\n\nPaquetes:\n${lines}\n\nTotal: ${money(Number(depositAmount))}\nReferencia NC: ${reference.trim()}\n\nYa envié mi comprobante en la tienda.`
setWaLink(`https://wa.me/50254560623?text=${encodeURIComponent(text)}`)
setAcceptTerms(false)
setMessage('')
setModal('order_done')
    await fetchMyOrders(user.id)
    setCart([])
    setPlayerId('')
    setReference('')
    setDepositAmount('')
    setDepositDate('')
    setReceipt(null)
    }
  async function updateOrder(id: string, status: 'completed' | 'rejected') {
    if (!window.confirm(status === 'completed' ? '¿Aprobar y completar este pedido?' : '¿Rechazar este pedido?')) return
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
  const cartTotal = cart.reduce((t, item) => t + Number(isReseller ? item.product.reseller_price : item.product.price) * item.quantity, 0)
  useEffect(() => { setDepositAmount(String(cartTotal)) }, [cartTotal])
  const usersWithOrders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; total: number }>()
    for (const o of orders) {
      const cur = map.get(o.user_id) ?? { id: o.user_id, name: o.profiles?.full_name || 'Sin nombre', count: 0, total: 0 }
      cur.count += 1
      if (o.status === 'completed') cur.total += Number(o.amount)
      map.set(o.user_id, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [orders])
  const historyOrders = orders.filter(o => o.user_id === historyUser)

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
           {cart.length > 0 && (
            <div
              className="admin-form"
              style={{
                marginTop: 20,
                padding: 16,
                border: '1px solid #00a3ff',
                borderRadius: 12
              }}
            >
              <h3>🛒 Mi carrito ({cart.length} paquetes)</h3>

              {cart.map(item => (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid #333'
                  }}
                >
                  <div>
                    <strong>{item.product.detail || item.product.name}</strong>
                    <p>
                      {money(Number(isReseller
                        ? item.product.reseller_price
                        : item.product.price) * item.quantity)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="button small"
                      onClick={() => changeCartQuantity(
                        item.product.id,
                        item.quantity - 1
                      )}
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      className="button small"
                      onClick={() => changeCartQuantity(
                        item.product.id,
                        item.quantity + 1
                      )}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <h3>
                Total: {money(cart.reduce((total, item) =>
                  total + Number(isReseller
                    ? item.product.reseller_price
                    : item.product.price) * item.quantity, 0
                ))}
              </h3>

              <button
                className="button"
                onClick={() => {
                  if (!user) {
                    setModal('login')
                    return
                  }

                  setProduct(cart[0].product)
                  setPlayerId('')
                  setDepositAmount(String(cart.reduce((total, item) =>
                    total + Number(isReseller
                      ? item.product.reseller_price
                      : item.product.price) * item.quantity, 0
                  )))
                  setMessage('El carrito está listo.')
                  setModal('checkout')
                }}
              >
                Continuar al pago
              </button>

              <button
                className="button secondary small"
                style={{ marginLeft: 8 }}
                onClick={() => setCart([])}
              >
                Vaciar carrito
              </button>
            </div>
          )}           
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
                          <button
  className="button small"
  onClick={() => {
    if (!user) {
      setModal('login')
      return
    }

    if (
      cart.length > 0 &&
      cart[0].product.game_name !== p.game_name
    ) {
      showToast('Solo puedes agregar paquetes del mismo juego al carrito.')
      return
    }

    addToCart(p)
  }}
>
  <ShoppingCart size={18} aria-label="Agregar al carrito" />
</button>
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
                    <p><strong>Cliente:</strong> {o.profiles?.full_name || o.user_id}</p>
<p><strong>Juego:</strong> {o.order_items?.[0]?.game_name || o.products?.game_name || '—'}</p>
<div style={{ background: '#111', padding: 8, borderRadius: 6, width: '100%' }}>
  <strong>Recargar:</strong>
  {(o.order_items ?? []).map((it, i) => (
    <p key={i}>{it.quantity} × {it.product_name} — {money(Number(it.line_total))}</p>
  ))}
  {(!o.order_items || o.order_items.length === 0) && <p>{o.products?.detail || '—'}</p>}
</div>
                    <p><strong>ID jugador:</strong> {o.player_id} | <strong>Monto:</strong> {money(Number(o.amount))} | <strong>NC:</strong> {o.reference_nc}</p>
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
            <div className="admin-form" style={{ marginTop: 20 }}>
              <h3>Pedidos por usuario</h3>
              {usersWithOrders.map(u => (
                <div key={u.id} style={{ backgroundColor: '#222', padding: 10, margin: '5px 0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <strong>{u.name}</strong>
                    <p style={{ fontSize: 13 }}>{u.count} pedidos | Completado: {money(u.total)}</p>
                  </div>
                  <button className="button small" onClick={() => { setHistoryUser(u.id); setModal('user_orders') }}>Ver</button>
                </div>
              ))}
              {usersWithOrders.length === 0 && <p>Aún no hay pedidos.</p>}
            </div>
            {message && <p role="status" style={{ color: '#00a3ff', marginTop: 12 }}>{message}</p>}
          </section>
        )}
      </main>
<footer className="wrap" style={{ borderTop: '1px solid #1b2a3a', marginTop: 40, padding: '28px 0 90px', textAlign: 'center' }}>
  <h3>Síguenos en @SamuelStoreGt</h3>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', margin: '14px 0' }}>
    <a className="button small" href="https://www.facebook.com/SamuelStoreGt" target="_blank" rel="noreferrer">Facebook</a>
    <a className="button small" href="https://www.instagram.com/SamuelStoreGt" target="_blank" rel="noreferrer">Instagram</a>
    <a className="button small" href="https://www.tiktok.com/@SamuelStoreGt" target="_blank" rel="noreferrer">TikTok</a>
    <a className="button small" href="https://wa.me/50254560623" target="_blank" rel="noreferrer">WhatsApp</a>
  </div>
  <p style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
    <button onClick={() => { setMessage(''); setModal('legal') }} style={{ textDecoration: 'underline' }}>Aviso legal</button>
    <button onClick={() => { setMessage(''); setModal('privacy') }} style={{ textDecoration: 'underline' }}>Política de privacidad</button>
    <button onClick={() => { setMessage(''); setModal('terms') }} style={{ textDecoration: 'underline' }}>Términos y condiciones</button>
  </p>
  <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
    © 2026 Samuel Store. Todos los derechos reservados. Guatemala.
  </p>
  <p style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
    Free Fire, Blood Strike y Roblox son marcas de sus respectivos dueños. Samuel Store no está afiliada a ellos.
  </p>
</footer>
<a
  href="https://wa.me/50254560623"
  target="_blank"
  rel="noreferrer"
  aria-label="Escríbenos por WhatsApp"
  style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 50, background: '#25d366', color: '#fff', fontWeight: 700, padding: '12px 18px', borderRadius: 999, boxShadow: '0 4px 14px rgba(0,0,0,.4)' }}
>
  WhatsApp
</a>
      {toast && (
        <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 140, zIndex: 60, background: '#0b1320', border: '1px solid #00a3ff', color: '#fff', padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}>
          {toast}
        </div>
      )}
      {cart.length > 0 && (
        <button
          aria-label="Ver carrito"
          onClick={() => {
            if (!user) { setModal('login'); return }
            setProduct(cart[0].product)
            setPlayerId('')
            setMessage('')
            setModal('checkout')
          }}
          style={{ position: 'fixed', right: 16, bottom: 76, zIndex: 50, background: '#00a3ff', color: '#fff', width: 56, height: 56, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.4)' }}
        >
          <ShoppingCart size={24} />
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#f06675', color: '#fff', fontSize: 12, fontWeight: 700, minWidth: 22, height: 22, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cart.reduce((t, item) => t + item.quantity, 0)}
          </span>
        </button>
      )}
      {!cookieOk && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, background: '#0b1320', borderTop: '1px solid #00a3ff', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13 }}>Usamos el almacenamiento del navegador solo para mantener tu sesión. No usamos cookies de publicidad. Más información en la <button type="button" onClick={() => setModal('privacy')} style={{ textDecoration: 'underline' }}>política de privacidad</button>.</p>
          <button className="button small" onClick={() => { try { localStorage.setItem('cookies_ok', '1') } catch { /* nada */ } setCookieOk(true) }}>Entendido</button>
        </div>
      )}
      <Dialog open={!!modal} onOpenChange={open => { if (!open) { setModal(null); setMessage('') } }}>
        <DialogContent className="store-dialog" style={{ maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
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
{modal === 'terms' && (
  <>
    <DialogHeader><DialogTitle>Términos y condiciones</DialogTitle></DialogHeader>
    <div style={{ maxHeight: 360, overflowY: 'auto', fontSize: 14, lineHeight: 1.5 }}>
      <p><strong>1. Quiénes somos.</strong><br />Samuel Store es una tienda digital de Guatemala que vende recargas y paquetes para videojuegos.</p>
      <p><strong>2. Pedidos y pago.</strong><br />El pago se hace por depósito bancario a las cuentas que aparecen al finalizar el pedido. Debes depositar el monto exacto y adjuntar tu comprobante. Tu pedido queda "En revisión" hasta que verifiquemos el pago.</p>
      <p><strong>3. Entrega.</strong><br />Las recargas se realizan manualmente después de confirmar el pago. El tiempo puede variar según la cantidad de pedidos. Si tienes dudas, escríbenos por WhatsApp.</p>
      <p><strong>4. ID de jugador.</strong><br />Eres responsable de escribir correctamente tu ID de jugador. Si la recarga se hace a un ID equivocado por un error del cliente, no se puede reembolsar.</p>
      <p><strong>5. Devoluciones.</strong><br />Por ser productos digitales, una vez realizada la recarga no hay devoluciones. Si no podemos verificar tu pago o no podemos entregar tu pedido, lo corregiremos o te devolveremos tu dinero.</p>
      <p><strong>6. Revendedores.</strong><br />Debes ser mayor de 18 años y ser aprobado por Samuel Store. Para mantenerte en el programa debes completar un mínimo de Q200 en pedidos cada mes. Si no se cumple, podemos retirarte del programa y volverás a precios de cliente.</p>
      <p><strong>7. Precios.</strong><br />Los precios pueden cambiar sin previo aviso. Se aplica el precio vigente al momento de hacer el pedido.</p>
      <p><strong>8. Uso correcto.</strong><br />Debes dar datos verdaderos. Si se envía un comprobante falso o alterado, el pedido se cancela y la cuenta puede ser bloqueada.</p>
      <p><strong>9. Marcas.</strong><br />Free Fire, Blood Strike, Roblox y otros nombres y logos pertenecen a sus respectivos dueños. Samuel Store no está afiliada, patrocinada ni respaldada por ellos.</p>
      <p><strong>10. Privacidad.</strong><br />Guardamos tu nombre, correo, ID de jugador y comprobantes solo para procesar tus pedidos. No vendemos tus datos a terceros.</p>
      <p><strong>11. Derechos de autor.</strong><br />El nombre, logo, diseño y contenido de esta tienda son propiedad de Samuel Store. Está prohibido copiarlos sin autorización.</p>
      <p><strong>12. Cambios y contacto.</strong><br />Podemos actualizar estos términos. Para cualquier consulta escríbenos por WhatsApp al +502 5456 0623 o en @SamuelStoreGt.</p>
      <p style={{ fontSize: 12, opacity: 0.7 }}>Última actualización: octubre de 2026.</p>
      {cart.length > 0 && <button className="button small" onClick={() => { setProduct(cart[0].product); setModal('checkout') }}>Volver al pago</button>}
    </div>
  </>
)}
          {modal === 'legal' && (
            <>
              <DialogHeader><DialogTitle>Aviso legal</DialogTitle></DialogHeader>
              <div style={{ maxHeight: '60dvh', overflowY: 'auto', fontSize: 14, lineHeight: 1.5 }}>
                <p><strong>Titular.</strong><br />Samuel Store, tienda digital de Guatemala, a cargo de Kevin Castillo.</p>
                <p><strong>Contacto.</strong><br />WhatsApp +502 5456 0623 y redes sociales @SamuelStoreGt.</p>
                <p><strong>Actividad.</strong><br />Venta de recargas y paquetes digitales para videojuegos.</p>
                <p><strong>Propiedad.</strong><br />El nombre, logo y diseño de la tienda son de Samuel Store. Las marcas de los juegos pertenecen a sus dueños y Samuel Store no está afiliada a ellos.</p>
                <p><strong>Uso de la tienda.</strong><br />Al usar esta tienda aceptas los Términos y condiciones y la Política de privacidad.</p>
              </div>
            </>
          )}
          {modal === 'privacy' && (
            <>
              <DialogHeader><DialogTitle>Política de privacidad</DialogTitle></DialogHeader>
              <div style={{ maxHeight: '60dvh', overflowY: 'auto', fontSize: 14, lineHeight: 1.5 }}>
                <p><strong>Datos que guardamos.</strong><br />Nombre, correo, ID de jugador, referencia, fecha y monto del depósito, comprobante y el historial de tus pedidos. Si solicitas ser revendedor, también tu edad y ventas estimadas. Tu contraseña la protege el servicio de acceso y nosotros no podemos verla.</p>
                <p><strong>Para qué los usamos.</strong><br />Para verificar pagos, realizar tus recargas, darte soporte y administrar el programa de revendedores.</p>
                <p><strong>Dónde se guardan.</strong><br />En Supabase, nuestro servicio de base de datos y almacenamiento. Los comprobantes se guardan en un almacenamiento privado.</p>
                <p><strong>Con quién los compartimos.</strong><br />No vendemos ni compartimos tus datos con terceros, salvo que la ley lo exija. Solo usamos WhatsApp cuando tú nos envías el mensaje.</p>
                <p><strong>Cookies y almacenamiento.</strong><br />Usamos el almacenamiento del navegador solo para mantener tu sesión iniciada. No usamos cookies de publicidad.</p>
                <p><strong>Tus derechos.</strong><br />Puedes pedirnos por WhatsApp que te mostremos, corrijamos o borremos tus datos. Algunos registros de ventas pueden conservarse el tiempo necesario.</p>
                <p style={{ fontSize: 12, opacity: 0.7 }}>Última actualización: octubre de 2026.</p>
              </div>
            </>
          )}
          {modal === 'user_orders' && (
            <>
              <DialogHeader>
                <DialogTitle>{usersWithOrders.find(u => u.id === historyUser)?.name || 'Pedidos del usuario'}</DialogTitle>
                <DialogDescription>Historial de pedidos</DialogDescription>
              </DialogHeader>
              <div style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
                {historyOrders.map(o => (
                  <div key={o.id} style={{ borderBottom: '1px solid #333', padding: '12px 0' }}>
                    <p><strong>{o.order_items?.[0]?.game_name || o.products?.game_name || 'Pedido'}</strong> — {new Date(o.created_at).toLocaleDateString()}</p>
                    <p>ID jugador: <strong>{o.player_id}</strong></p>
                    {(o.order_items ?? []).map((it, i) => (
                      <p key={i}>{it.quantity} × {it.product_name} — {money(Number(it.line_total))}</p>
                    ))}
                    {(!o.order_items || o.order_items.length === 0) && <p>{o.products?.detail || '—'}</p>}
                    <p>Total: <strong>{money(Number(o.amount))}</strong> | NC: {o.reference_nc}</p>
                    <p>Estado: <strong style={{ color: o.status === 'completed' ? 'green' : o.status === 'rejected' ? 'red' : 'orange' }}>
                      {o.status === 'completed' ? 'Completado' : o.status === 'rejected' ? 'Rechazado' : 'En revisión'}
                    </strong></p>
                    {o.receipt_signed_url && <a href={o.receipt_signed_url} target="_blank" rel="noreferrer" style={{ color: '#00a3ff', textDecoration: 'underline' }}>Ver comprobante</a>}
                  </div>
                ))}
                {historyOrders.length === 0 && <p>Sin pedidos.</p>}
              </div>
              <button className="button secondary small" onClick={() => setModal(null)}>Cerrar</button>
            </>
          )}
          {modal === 'order_done' && (
  <>
    <DialogHeader><DialogTitle>¡Pedido enviado!</DialogTitle><DialogDescription>Recibimos tu comprobante. Para que sea más rápido, envíanos el detalle por WhatsApp.</DialogDescription></DialogHeader>
    <div className="auth-form">
      <a className="button" href={waLink} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp</a>
      <button className="button secondary small" onClick={() => setModal('my_orders')}>Ver mis pedidos</button>
    </div>
  </>
)}
          {modal === 'my_orders' && (
            <>
              <DialogHeader><DialogTitle>Mis pedidos</DialogTitle></DialogHeader>
              <div style={{ maxHeight: '60dvh', overflowY: 'auto' }}>
                {myOrders.map(o => (
                  <div key={o.id} style={{ borderBottom: '1px solid #333', padding: '10px 0' }}>
                    <p><strong>{o.order_items?.[0]?.game_name || o.products?.game_name || 'Pedido'}</strong></p>
{(o.order_items ?? []).map((it, i) => (<p key={i}>{it.quantity} × {it.product_name} — {money(Number(it.line_total))}</p>))}
{(!o.order_items || o.order_items.length === 0) && <p>{o.products?.detail || '—'}</p>}
                    <p>ID jugador: <strong>{o.player_id}</strong></p>
<p>Total: <strong>{money(Number(o.amount))}</strong> | {new Date(o.created_at).toLocaleDateString()}</p>
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
                <div style={{ background: '#222', padding: 10, borderRadius: 8 }}>
  {cart.map(item => {
    const unit = Number(isReseller ? item.product.reseller_price : item.product.price)
    return (
      <p key={item.product.id}>
        {item.quantity} × <strong>{item.product.detail || item.product.name}</strong> — {money(unit * item.quantity)}
      </p>
    )
  })}
  <p><strong>Total a depositar: {money(cart.reduce((t, item) => t + Number(isReseller ? item.product.reseller_price : item.product.price) * item.quantity, 0))}</strong></p>
</div>
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
                <label>Monto depositado (Q)<input type="number" value={depositAmount} readOnly /></label>
                <label>Fecha del depósito<input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} /></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#222', padding: 10, borderRadius: 5 }}>
                  <Upload size={20} />{receipt ? receipt.name : 'Seleccionar comprobante'}
                  <input type="file" style={{ display: 'none' }} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center', fontSize: 14 }}>
  <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} style={{ width: 22, height: 22, minWidth: 22, margin: 0, padding: 0, flex: '0 0 22px' }} />
  <span>Acepto los <button type="button" onClick={() => setModal('terms')} style={{ textDecoration: 'underline' }}>términos y condiciones</button></span>
</label>
                <div style={{ position: 'sticky', bottom: 0, background: '#0b1320', padding: '10px 0', zIndex: 5 }}>
  {message && <p role="status" style={{ color: '#00a3ff', marginBottom: 8 }}>{message}</p>}
  <button className="button" style={{ width: '100%' }} disabled={loading} onClick={() => { void submitOrder() }}>{loading ? 'Enviando...' : 'Confirmar pedido'}</button>
</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
  }
