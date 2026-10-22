import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import {
  ArrowRight, Gamepad2, LogIn, LogOut, Package, Plus, Minus,
  ShoppingCart, Trash2, X, ShieldCheck, RefreshCw, Wallet,
  Users, Boxes, ClipboardList
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

type Category = 'Videojuegos' | 'Streaming' | 'Redes sociales' | 'Reventa'
type Product = {
  id: string
  name: string
  detail: string
  game_name: string | null
  category: Category
  price: number
  reseller_price: number
  active: boolean
  image?: string | null
}
type Bank = { id: string; bank_name: string; account_number: string; account_holder: string; active: boolean }
type Profile = { id: string; full_name: string; role: string; application_status?: string }
type CartItem = { product: Product; quantity: number }
type Order = {
  id: string; user_id: string; product_id: string | null; player_id: string
  amount: number; reference_nc: string; deposit_date: string | null
  receipt_path: string | null; status: string; created_at: string
  products?: { detail?: string; game_name?: string } | null
  profiles?: { full_name?: string } | null
}
const GAME_LOGOS: Record<string, string> = {
  freefire: 'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos/e39a86810c27bc4699a0e50628b2a402.jpg',
  bloodstrike: 'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos/9476bb2a4d3910f6c63819d27abd24ef.jpg',
  roblox: 'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos/070690595d2dc5c5b20eefbabe9f2748.jpg',
}
const CATEGORIES: Category[] = ['Videojuegos', 'Streaming', 'Redes sociales', 'Reventa']
const money = (n: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(n || 0))
const gameKey = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '')
const getGameLogo = (game: string) => GAME_LOGOS[gameKey(game)]

function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [modal, setModal] = useState<'login'|'register'|'cart'|'checkout'|'orders'|'admin'|'reseller'|null>(null)
  const [category, setCategory] = useState<Category | 'Todos'>('Todos')
  const [selectedGame, setSelectedGame] = useState('Todos')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [reference, setReference] = useState('')
  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0,10))
  const [receipt, setReceipt] = useState<File | null>(null)
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [newName, setNewName] = useState('')
  const [newDetail, setNewDetail] = useState('')
  const [newGame, setNewGame] = useState('Free Fire')
  const [newCategory, setNewCategory] = useState<Category>('Videojuegos')
  const [newPrice, setNewPrice] = useState('')
  const [newResellerPrice, setNewResellerPrice] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const isAdmin = profile?.role === 'admin'
  const isReseller = profile?.role === 'reseller'
  const cartCount = cart.reduce((n, x) => n + x.quantity, 0)
  const cartTotal = cart.reduce((n, x) => n + x.quantity * Number(isReseller ? x.product.reseller_price : x.product.price), 0)
  const games = useMemo(() => ['Todos', ...Array.from(new Set(products.filter(p => p.category === 'Videojuegos' && p.game_name).map(p => p.game_name as string)))], [products])
  const shownProducts = products.filter(p => (category === 'Todos' || p.category === category) && (selectedGame === 'Todos' || p.game_name === selectedGame))

  async function refreshProducts() {
    if (!supabase) return
    const { data, error } = await supabase.from('products').select('id,name,detail,game_name,category,price,reseller_price,active,image').eq('active', true).order('category').order('name')
    if (error) {
      // Compatibilidad con instalaciones que aún no tienen columna image.
      const fallback = await supabase.from('products').select('id,name,detail,game_name,category,price,reseller_price,active').eq('active', true).order('name')
      if (fallback.error) setMessage(`No se pudieron cargar los productos: ${fallback.error.message}`)
      else setProducts((fallback.data ?? []) as Product[])
      return
    }
    setProducts((data ?? []) as Product[])
  }

  async function refreshBanks() {
    if (!supabase) { setMessage('Falta configurar la conexión con Supabase.'); return }
    const { data, error } = await supabase.from('bank_accounts').select('id,bank_name,account_number,account_holder,active').eq('active', true)
    if (error) {
      console.error('Error al cargar cuentas bancarias:', error)
      setMessage(`No se pudieron cargar las cuentas bancarias: ${error.message}`)
      return
    }
    setBanks((data ?? []) as Bank[])
    if (!data?.length) setMessage('No hay cuentas bancarias activas.')
  }

  async function refreshMyOrders(uid = user?.id) {
    if (!supabase || !uid) return
    const { data, error } = await supabase.from('orders').select('id,user_id,product_id,player_id,amount,reference_nc,deposit_date,receipt_path,status,created_at,products(detail,game_name)').eq('user_id', uid).order('created_at', { ascending: false })
    if (!error) setMyOrders((data ?? []) as Order[])
  }

  async function refreshAdmin() {
    if (!supabase || !isAdmin) return
    const { data, error } = await supabase.from('orders').select('id,user_id,product_id,player_id,amount,reference_nc,deposit_date,receipt_path,status,created_at,products(detail,game_name),profiles(full_name)').order('created_at', { ascending: false }).limit(100)
    if (error) setMessage(`No se pudieron cargar los pedidos: ${error.message}`)
    else setOrders((data ?? []) as Order[])
    await refreshBanks()
  }

  async function loadUser(u: User | null) {
    setUser(u)
    if (!supabase || !u) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('id,full_name,role,application_status').eq('id', u.id).maybeSingle()
    setProfile((data as Profile | null) ?? null)
    await refreshMyOrders(u.id)
  }

  useEffect(() => {
    if (!supabase) { setMessage('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Netlify.'); return }
    void refreshProducts()
    void refreshBanks()
    supabase.auth.getSession().then(({ data }) => { void loadUser(data.session?.user ?? null) })
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { void loadUser(session?.user ?? null) }, 0)
    })
    return () => auth.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (modal === 'checkout') void refreshBanks()
    if (modal === 'admin' && isAdmin) void refreshAdmin()
    if (modal === 'orders') void refreshMyOrders()
  }, [modal, isAdmin])

  function addToCart(p: Product) {
    setCart(old => {
      const found = old.find(x => x.product.id === p.id)
      return found ? old.map(x => x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x) : [...old, { product: p, quantity: 1 }]
    })
    setMessage(`${p.name} agregado al carrito.`)
  }
  function changeQuantity(id: string, q: number) {
    setCart(old => q <= 0 ? old.filter(x => x.product.id !== id) : old.map(x => x.product.id === id ? { ...x, quantity: q } : x))
  }

  async function authSubmit(register: boolean) {
    if (!supabase) return setMessage('Supabase no está configurado.')
    setLoading(true); setMessage('')
    try {
      if (register) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        if (error) throw error
        if (data.user) {
          const { error: pe } = await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName, role: 'customer' })
          if (pe) console.warn('Perfil pendiente de crear:', pe.message)
        }
        setMessage('Registro enviado. Si Supabase solicita confirmar el correo, revisa tu bandeja.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setModal(null)
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo completar la autenticación.') }
    finally { setLoading(false) }
  }

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    setProfile(null); setUser(null); setModal(null)
  }

  async function submitOrder() {
    if (!supabase) return setMessage('Supabase no está configurado.')
    if (!user) { setModal('login'); return setMessage('Inicia sesión para realizar tu compra.') }
    if (!cart.length) return setMessage('Agrega al menos un paquete al carrito.')
    if (!playerId.trim()) return setMessage('Escribe tu ID de jugador o el dato solicitado por el servicio.')
    if (!reference.trim()) return setMessage('Escribe el número de referencia del depósito.')
    if (!depositDate) return setMessage('Selecciona la fecha del depósito.')
    if (!receipt) return setMessage('Adjunta la fotografía o captura del comprobante.')
    setLoading(true); setMessage('')
    let uploadedPath = ''
    let orderId = ''
    try {
      const ext = receipt.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
      uploadedPath = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('boletas').upload(uploadedPath, receipt, { upsert: false, contentType: receipt.type || 'image/jpeg' })
      if (uploadError) throw new Error(`No se pudo subir el comprobante: ${uploadError.message}`)
      const first = cart[0]
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        user_id: user.id, product_id: first.product.id, player_id: playerId.trim(),
        amount: cartTotal, reference_nc: reference.trim(), deposit_date: depositDate,
        receipt_path: uploadedPath, status: 'pending'
      }).select('id').single()
      if (orderError) throw new Error(`No se pudo registrar el pedido: ${orderError.message}`)
      orderId = order.id
      const items = cart.map(x => ({ order_id: orderId, product_id: x.product.id, quantity: x.quantity, unit_price: Number(isReseller ? x.product.reseller_price : x.product.price) }))
      const { error: itemsError } = await supabase.from('order_items').insert(items)
      if (itemsError) {
        await supabase.from('orders').delete().eq('id', orderId)
        throw new Error(`El pedido no se guardó porque falta configurar la tabla order_items o sus permisos: ${itemsError.message}`)
      }
      setCart([]); setPlayerId(''); setReference(''); setReceipt(null)
      setMessage('¡Pedido enviado! El administrador revisará tu comprobante.')
      setModal('orders')
      await refreshMyOrders(user.id)
    } catch (e) {
      if (uploadedPath) await supabase.storage.from('boletas').remove([uploadedPath])
      setMessage(e instanceof Error ? e.message : 'No se pudo completar el pedido.')
    } finally { setLoading(false) }
  }

  async function changeOrderStatus(order: Order, status: string) {
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (error) setMessage(`No se pudo actualizar el pedido: ${error.message}`)
    else { setMessage('Estado del pedido actualizado.'); await refreshAdmin() }
  }

  async function saveProduct() {
    if (!supabase || !isAdmin) return
    const price = Number(newPrice), reseller = Number(newResellerPrice || newPrice)
    if (!newName.trim() || !newDetail.trim() || !Number.isFinite(price) || price < 0) return setMessage('Completa nombre, detalle y precio válido.')
    const { error } = await supabase.from('products').insert({
      name: newName.trim(), detail: newDetail.trim(), game_name: newGame,
      category: newCategory, price, reseller_price: reseller, active: true
    })
    if (error) setMessage(`No se pudo guardar el producto: ${error.message}`)
    else { setMessage('Producto creado.'); setNewName(''); setNewDetail(''); setNewPrice(''); setNewResellerPrice(''); await refreshProducts() }
  }

  async function saveBank() {
    if (!supabase || !isAdmin) return
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) return setMessage('Completa todos los campos de la cuenta.')
    const { error } = await supabase.from('bank_accounts').insert({ bank_name: bankName.trim(), account_number: accountNumber.trim(), account_holder: accountHolder.trim(), active: true })
    if (error) setMessage(`No se pudo guardar la cuenta: ${error.message}`)
    else { setMessage('Cuenta bancaria agregada.'); setBankName(''); setAccountNumber(''); setAccountHolder(''); await refreshBanks() }
  }

  async function applyReseller() {
    if (!supabase || !user) { setModal('login'); return setMessage('Inicia sesión para solicitar ser revendedor.') }
    const { error } = await supabase.from('profiles').update({ application_status: 'pending' }).eq('id', user.id)
    if (error) setMessage(`No se pudo enviar la solicitud: ${error.message}`)
    else setMessage('Solicitud enviada al administrador.')
  }

  async function reviewReseller(id: string, approve: boolean) {
    if (!supabase || !isAdmin) return
    const { error } = await supabase.from('profiles').update({ role: approve ? 'reseller' : 'customer', application_status: approve ? 'approved' : 'rejected' }).eq('id', id)
    if (error) setMessage(`No se pudo actualizar la solicitud: ${error.message}`)
    else { setMessage('Solicitud actualizada.'); await refreshAdmin() }
  }

  const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-50'
  const blue = `${btn} bg-[#00A3FF] text-black hover:bg-sky-300`
  const dark = `${btn} border border-white/10 bg-white/5 text-white hover:bg-white/10`
  const input = 'w-full rounded-xl border border-white/10 bg-[#111318] px-3 py-3 text-white outline-none focus:border-[#00A3FF]'
  const card = 'rounded-2xl border border-white/10 bg-[#111318]'

  return <div className="min-h-screen bg-[#0a0a0a] text-white">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <button className="flex items-center gap-3 text-left" onClick={() => { setModal(null); setCategory('Todos'); setSelectedGame('Todos') }}>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00A3FF] text-xl font-black text-black">S</div>
          <div><div className="text-lg font-black tracking-tight">SAMUEL <span className="text-[#00A3FF]">STORE</span></div><div className="text-xs text-gray-400">En Samuel Store, tu meta es nuestra meta</div></div>
        </button>
        <div className="flex items-center gap-2">
          {user ? <><button className={dark} onClick={() => setModal('orders')}><ClipboardList size={17}/><span className="hidden sm:inline">Mis pedidos</span></button>{isAdmin && <button className={dark} onClick={() => setModal('admin')}><ShieldCheck size={17}/><span className="hidden sm:inline">Admin</span></button>}<button className={dark} onClick={logout} aria-label="Cerrar sesión"><LogOut size={17}/></button></> : <button className={dark} onClick={() => setModal('login')}><LogIn size={17}/> Entrar</button>}
          <button className={`${blue} relative px-3`} onClick={() => setModal('cart')} aria-label="Abrir carrito"><ShoppingCart size={19}/>{cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-black text-black">{cartCount}</span>}</button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="mb-8 overflow-hidden rounded-3xl border border-[#00A3FF]/20 bg-gradient-to-br from-[#101d2a] via-[#0c1118] to-[#0a0a0a] p-6 sm:p-10">
        <div className="max-w-2xl"><span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00A3FF]/30 px-3 py-1 text-xs font-bold text-[#00A3FF]"><Gamepad2 size={14}/> SERVICIOS DIGITALES</span><h1 className="text-3xl font-black sm:text-5xl">Tu mundo digital, <span className="text-[#00A3FF]">a tu alcance.</span></h1><p className="mt-4 max-w-xl text-gray-300">Recargas de videojuegos y servicios digitales con atención personalizada y pagos mediante depósito o transferencia.</p><div className="mt-6 flex flex-wrap gap-3"><button className={blue} onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Ver catálogo <ArrowRight size={17}/></button><button className={dark} onClick={() => setModal('reseller')}><Users size={17}/> Ser revendedor</button></div></div>
      </section>

      {message && <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#00A3FF]/30 bg-[#00A3FF]/10 p-3 text-sm text-sky-100"><span>{message}</span><button onClick={() => setMessage('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}

      <section id="catalogo">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-[#00A3FF]">Catálogo</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">Elige tus paquetes</h2></div><button className={dark} onClick={() => { void refreshProducts(); void refreshBanks() }}><RefreshCw size={16}/> Actualizar</button></div>
        <div className="mb-4 flex flex-wrap gap-2">{(['Todos', ...CATEGORIES] as const).map(c => <button key={c} className={`${btn} ${category === c ? 'bg-[#00A3FF] text-black' : 'border border-white/10 bg-white/5 text-gray-300'}`} onClick={() => { setCategory(c); setSelectedGame('Todos') }}>{c}</button>)}</div>
        {category === 'Videojuegos' && games.length > 1 && <div className="mb-5 flex flex-wrap gap-2">{games.map(g => <button key={g} className={`${btn} text-sm ${selectedGame === g ? 'bg-white text-black' : 'border border-white/10 bg-white/5 text-gray-300'}`} onClick={() => setSelectedGame(g)}>{g}</button>)}</div>}
        {shownProducts.length === 0 ? <div className={`${card} p-10 text-center`}><Package className="mx-auto mb-3 text-gray-500" size={36}/><h3 className="text-lg font-bold">Todavía no hay productos para mostrar</h3><p className="mt-2 text-sm text-gray-400">Cuando haya productos activos aparecerán aquí.</p></div> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shownProducts.map(p => {
            const logo = p.image || (p.game_name ? getGameLogo(p.game_name) : undefined)
            return <article key={p.id} className={`${card} flex flex-col overflow-hidden`}>
              <div className="relative grid h-36 place-items-center bg-gradient-to-br from-[#142435] to-[#101318] p-4">{logo ? <img src={logo} alt={p.game_name || p.name} className="h-full max-w-full object-contain" onError={e => { e.currentTarget.style.display = 'none' }}/> : <Gamepad2 size={46} className="text-[#00A3FF]"/>}<span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-gray-200">{p.category}</span></div>
              <div className="flex flex-1 flex-col p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#00A3FF]">{p.game_name || p.category}</p><h3 className="mt-1 text-lg font-bold">{p.name}</h3><p className="mt-1 flex-1 text-sm text-gray-400">{p.detail}</p><div className="mt-4 flex items-end justify-between gap-2"><div><div className="text-2xl font-black">{money(isReseller ? p.reseller_price : p.price)}</div>{isReseller && <div className="text-xs text-gray-500">Precio de revendedor</div>}</div><button className={blue} onClick={() => addToCart(p)}><Plus size={17}/> Agregar</button></div></div>
            </article>
          })}</div>}
      </section>
      <footer className="mt-12 border-t border-white/10 py-6 text-center text-sm text-gray-500">© {new Date().getFullYear()} Samuel Store · Servicios Digitales</footer>
    </main>

    {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d0f13] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-black">{modal === 'login' ? 'Iniciar sesión' : modal === 'register' ? 'Crear cuenta' : modal === 'cart' ? 'Tu carrito' : modal === 'checkout' ? 'Finalizar compra' : modal === 'orders' ? 'Mis pedidos' : modal === 'admin' ? 'Panel de administración' : 'Programa de revendedores'}</h2><button className={dark} onClick={() => setModal(null)} aria-label="Cerrar"><X size={18}/></button></div>

        {(modal === 'login' || modal === 'register') && <div className="space-y-3">{modal === 'register' && <input className={input} placeholder="Nombre completo" value={fullName} onChange={e => setFullName(e.target.value)}/>}<input className={input} type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)}/><input className={input} type="password" placeholder="Contraseña (mínimo 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)}/><button className={`${blue} w-full`} disabled={loading} onClick={() => void authSubmit(modal === 'register')}>{loading ? 'Procesando...' : modal === 'register' ? 'Crear cuenta' : 'Entrar'}</button><button className="w-full py-2 text-sm text-[#00A3FF]" onClick={() => { setModal(modal === 'login' ? 'register' : 'login'); setMessage('') }}>{modal === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta. Iniciar sesión'}</button></div>}

        {modal === 'cart' && <div>{cart.length === 0 ? <div className="py-8 text-center text-gray-400"><ShoppingCart size={36} className="mx-auto mb-3"/>Tu carrito está vacío.</div> : <><div className="space-y-3">{cart.map(x => <div key={x.product.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0 flex-1"><p className="font-bold">{x.product.name}</p><p className="text-sm text-gray-400">{money(isReseller ? x.product.reseller_price : x.product.price)} c/u</p></div><div className="flex items-center gap-2"><button className={dark} onClick={() => changeQuantity(x.product.id, x.quantity - 1)} aria-label="Restar"><Minus size={15}/></button><span className="w-5 text-center">{x.quantity}</span><button className={dark} onClick={() => changeQuantity(x.product.id, x.quantity + 1)} aria-label="Sumar"><Plus size={15}/></button><button className="rounded-lg p-2 text-red-400 hover:bg-red-400/10" onClick={() => changeQuantity(x.product.id, 0)} aria-label="Eliminar"><Trash2 size={16}/></button></div></div>)}</div><div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4"><span className="text-gray-300">Total</span><span className="text-2xl font-black">{money(cartTotal)}</span></div><button className={`${blue} mt-4 w-full`} onClick={() => { if (!user) { setModal('login'); setMessage('Inicia sesión para continuar con tu compra.') } else setModal('checkout') }}>Continuar al pago <ArrowRight size={17}/></button></>}</div>}

        {modal === 'checkout' && <div className="space-y-4"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="mb-2 flex items-center justify-between"><span className="font-bold">Resumen de compra</span><span className="text-xl font-black">{money(cartTotal)}</span></div>{cart.map(x => <div key={x.product.id} className="flex justify-between gap-3 py-1 text-sm text-gray-300"><span>{x.quantity} × {x.product.name}</span><span>{money(x.quantity * Number(isReseller ? x.product.reseller_price : x.product.price))}</span></div>)}</div><div><div className="mb-2 flex items-center justify-between"><h3 className="font-bold"><Wallet className="mr-2 inline" size={17}/>Deposita a una de estas cuentas</h3><button className="text-sm text-[#00A3FF]" onClick={() => void refreshBanks()}>Actualizar</button></div>{banks.length ? <div className="grid gap-2 sm:grid-cols-2">{banks.map(b => <div key={b.id} className="rounded-xl border border-white/10 p-3"><p className="font-bold">{b.bank_name}</p><p className="mt-1 break-all text-sm text-gray-300">{b.account_number}</p><p className="text-xs text-gray-500">A nombre de: {b.account_holder}</p><button className="mt-2 text-xs font-bold text-[#00A3FF]" onClick={() => { void navigator.clipboard?.writeText(b.account_number); setMessage('Número de cuenta copiado si tu navegador permite el portapapeles.') }}>Copiar cuenta</button></div>)}</div> : <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-200">No hay cuentas bancarias disponibles. Pulsa “Actualizar”; si sigue igual, revisa el error que aparece arriba.</p>}</div><label className="block text-sm text-gray-300">ID de jugador / usuario del servicio<input className={`${input} mt-1`} value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="Escribe el ID correcto"/></label><label className="block text-sm text-gray-300">Número de referencia del depósito<input className={`${input} mt-1`} value={reference} onChange={e => setReference(e.target.value)} placeholder="Número de boleta o referencia"/></label><label className="block text-sm text-gray-300">Fecha del depósito<input className={`${input} mt-1`} type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)}/></label><label className="block text-sm text-gray-300">Comprobante del depósito<input className={`${input} mt-1`} type="file" accept="image/*,.pdf" onChange={e => setReceipt(e.target.files?.[0] ?? null)}/></label><button className={`${blue} w-full`} disabled={loading || !cart.length} onClick={() => void submitOrder()}>{loading ? 'Enviando pedido...' : 'Enviar pedido y comprobante'}</button><p className="text-xs text-gray-500">El pedido quedará pendiente hasta que el administrador confirme el pago.</p></div>}

        {modal === 'orders' && <div className="space-y-3">{myOrders.length === 0 ? <p className="py-8 text-center text-gray-400">Todavía no tienes pedidos.</p> : myOrders.map(o => <div key={o.id} className="rounded-xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{o.products?.game_name || 'Pedido digital'}</p><p className="text-sm text-gray-400">{o.products?.detail || 'Compra de paquetes'}</p><p className="mt-1 text-xs text-gray-500">Ref. {o.reference_nc} · {new Date(o.created_at).toLocaleString('es-GT')}</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{o.status}</span></div><p className="mt-3 text-xl font-black">{money(o.amount)}</p></div>)}</div>}

        {modal === 'reseller' && <div className="space-y-4"><div className="rounded-xl border border-[#00A3FF]/20 bg-[#00A3FF]/5 p-4"><h3 className="font-bold">Vende servicios digitales</h3><p className="mt-1 text-sm text-gray-300">Los revendedores aprobados acceden a precios especiales. La meta mínima de ventas es Q200 al mes.</p></div><button className={`${blue} w-full`} onClick={() => void applyReseller()}>Solicitar ser revendedor</button>{!user && <button className={`${dark} w-full`} onClick={() => setModal('login')}>Inicia sesión primero</button>}</div>}

        {modal === 'admin' && isAdmin && <div className="space-y-6">
          <section><h3 className="mb-3 flex items-center gap-2 font-bold"><Boxes size={18}/> Crear producto</h3><div className="grid gap-3 sm:grid-cols-2"><input className={input} placeholder="Nombre del paquete" value={newName} onChange={e => setNewName(e.target.value)}/><input className={input} placeholder="Detalle (ej. 100 diamantes)" value={newDetail} onChange={e => setNewDetail(e.target.value)}/><select className={input} value={newCategory} onChange={e => setNewCategory(e.target.value as Category)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><input className={input} placeholder="Juego o servicio" value={newGame} onChange={e => setNewGame(e.target.value)}/><input className={input} type="number" min="0" step="0.01" placeholder="Precio normal Q" value={newPrice} onChange={e => setNewPrice(e.target.value)}/><input className={input} type="number" min="0" step="0.01" placeholder="Precio revendedor Q" value={newResellerPrice} onChange={e => setNewResellerPrice(e.target.value)}/></div><button className={`${blue} mt-3 w-full`} onClick={() => void saveProduct()}><Plus size={16}/> Guardar producto</button></section>
          <section className="border-t border-white/10 pt-5"><h3 className="mb-3 flex items-center gap-2 font-bold"><Wallet size={18}/> Agregar cuenta bancaria</h3><div className="grid gap-3 sm:grid-cols-3"><input className={input} placeholder="Banco" value={bankName} onChange={e => setBankName(e.target.value)}/><input className={input} placeholder="Número de cuenta" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}/><input className={input} placeholder="Titular" value={accountHolder} onChange={e => setAccountHolder(e.target.value)}/></div><button className={`${blue} mt-3 w-full`} onClick={() => void saveBank()}><Plus size={16}/> Guardar cuenta</button><div className="mt-3 space-y-2">{banks.map(b => <div key={b.id} className="rounded-lg border border-white/10 p-3 text-sm"><b>{b.bank_name}</b> · {b.account_number} · {b.account_holder}</div>)}</div></section>
          <section className="border-t border-white/10 pt-5"><h3 className="mb-3 flex items-center gap-2 font-bold"><ClipboardList size={18}/> Pedidos recientes</h3><button className={`${dark} mb-3 w-full`} onClick={() => void refreshAdmin()}><RefreshCw size={16}/> Actualizar pedidos</button>{orders.map(o => <div key={o.id} className="mb-3 rounded-xl border border-white/10 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{o.profiles?.full_name || 'Cliente'} · {o.products?.game_name || 'Pedido múltiple'}</p><p className="text-sm text-gray-400">{o.products?.detail || 'Paquetes digitales'} · ID {o.player_id}</p><p className="text-xs text-gray-500">Ref. {o.reference_nc} · {new Date(o.created_at).toLocaleString('es-GT')}</p><p className="mt-1 font-black">{money(o.amount)}</p></div><select className={`${input} w-auto min-w-36`} value={o.status} onChange={e => void changeOrderStatus(o, e.target.value)}><option value="pending">Pendiente</option><option value="payment_confirmed">Pago confirmado</option><option value="in_review">En revisión</option><option value="completed">Completado</option><option value="rejected">Rechazado</option></select></div></div>)}</section>
        </div>}
      </div>
    </div>}
  </div>
}
