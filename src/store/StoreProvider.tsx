// Estado compartido de la tienda: sesión, rol, catálogo, pedidos, carrito,
// diálogo abierto y avisos. Las secciones leen y actualizan desde aquí con useStore().
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Supabase } from '@/lib/supabase'
import { stockMap } from '@/features/streaming/streaming'
import * as q from './queries'
import type { Bank, CartLine, InventoryAccount, Item, ModalName, Order, Product, Profile, StockRow } from './types'

type LastOrder = { waLink: string; isStreaming: boolean }

export type StoreValue = {
  supabase: Supabase
  // sesión y rol
  user: User | null
  isAdmin: boolean
  isReseller: boolean
  resellerApplicationStatus: string | null
  setResellerApplicationStatus: (s: string | null) => void
  // avisos y diálogos
  loading: boolean
  setLoading: (v: boolean) => void
  message: string
  setMessage: (m: string) => void
  toast: string
  showToast: (text: string) => void
  modal: ModalName | null
  setModal: (m: ModalName | null) => void
  // datos
  products: Product[]
  banks: Bank[]
  myOrders: Order[]
  stock: StockRow[]
  stockByKey: Map<string, StockRow>
  profiles: Profile[]
  orders: Order[]
  allProducts: Product[]
  inventory: InventoryAccount[] | null
  refreshProducts: () => Promise<void>
  refreshMyOrders: (uid?: string) => Promise<void>
  refreshAdmin: () => Promise<void>
  refreshStock: () => Promise<void>
  // carrito y pago
  cart: CartLine[]
  unitPrice: (p: Product) => number
  cartTotal: number
  addToCart: (p: Product) => void
  changeCartQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  checkoutSession: number
  openCheckout: (initialMessage?: string) => void
  lastOrder: LastOrder
  setLastOrder: (o: LastOrder) => void
  // selección que cruza diálogos
  historyUser: string | null
  setHistoryUser: (id: string | null) => void
  renewItem: Item | null
  setRenewItem: (it: Item | null) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return value
}

export function StoreProvider({ supabase, children }: { supabase: Supabase; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isReseller, setIsReseller] = useState(false)
  const [resellerApplicationStatus, setResellerApplicationStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<ModalName | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryAccount[] | null>(null)

  const [cart, setCart] = useState<CartLine[]>([])
  const [checkoutSession, setCheckoutSession] = useState(0)
  const [lastOrder, setLastOrder] = useState<LastOrder>({ waLink: '', isStreaming: false })
  const [historyUser, setHistoryUser] = useState<string | null>(null)
  const [renewItem, setRenewItem] = useState<Item | null>(null)

  function showToast(text: string) {
    setToast(text)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function refreshProducts() {
    const { data, error } = await q.fetchActiveProducts(supabase)
    if (error) setMessage(`No se pudo cargar el catálogo: ${error.message}`)
    if (data) setProducts(data)
  }

  async function refreshBanks() {
    const { data, error } = await q.fetchActiveBanks(supabase)
    if (error) {
      console.error('Error al cargar cuentas:', error.message)
      setMessage(`Error al cargar cuentas bancarias: ${error.message}`)
      return
    }
    setBanks(data)
  }

  async function refreshStock() {
    setStock(await q.fetchStock(supabase))
  }

  async function refreshMyOrders(uid = user?.id) {
    if (!uid) return
    const { data, error } = await q.fetchOrdersOf(supabase, uid)
    if (!error && data) setMyOrders(data)
  }

  async function refreshAdmin() {
    const r = await q.fetchAdminData(supabase)
    if (r.profiles) setProfiles(r.profiles)
    if (r.banks) setBanks(r.banks)
    if (r.allProducts) setAllProducts(r.allProducts)
    if (r.orders) setOrders(r.orders)
    setInventory(r.inventory)
    void refreshStock()
    const { profiles: pe, banks: be, orders: oe } = r.errors
    if (pe || be || oe) {
      console.error('Error en perfiles:', pe?.message)
      console.error('Error en cuentas bancarias:', be?.message)
      console.error('Error en pedidos:', oe?.message)
      setMessage(be ? `Error al cargar cuentas bancarias: ${be.message}` : pe ? `Error en perfiles: ${pe.message}` : `Error en pedidos: ${oe?.message}`)
    }
  }

  async function loadUserRole(current: User) {
    const { data, error } = await q.fetchUserRole(supabase, current.id)
    if (error) {
      console.error('No se pudo leer el perfil:', error.message)
      return
    }
    const role = data?.role ?? 'customer'
    setIsAdmin(role === 'admin')
    setIsReseller(role === 'reseller' || role === 'admin')
    setResellerApplicationStatus(data?.application_status ?? null)
    if (role === 'admin') await refreshAdmin()
    await refreshMyOrders(current.id)
  }

  useEffect(() => {
    let alive = true
    void refreshProducts()
    void refreshBanks()
    void refreshStock()
    // Supabase puede procesar el token de recuperación antes de registrar el listener.
    // Se conserva un marcador explícito en la URL para volver a abrir el formulario.
    const recoveryRequested = new URLSearchParams(window.location.search).get('auth_action') === 'recover'
      || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const current = data.session?.user ?? null
      setUser(current)
      if (current && recoveryRequested) {
        setMessage('')
        setModal('new_password')
      } else if (!current && recoveryRequested) {
        setMessage('El enlace de recuperación venció o no es válido. Solicita uno nuevo.')
        setModal('forgot')
      }
      if (current) await loadUserRole(current)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const current = session?.user ?? null
      if (event === 'PASSWORD_RECOVERY') { setMessage(''); setModal('new_password') }
      setUser(current)
      if (current) window.setTimeout(() => { void loadUserRole(current) }, 0)
      else {
        setIsAdmin(false)
        setIsReseller(false)
        setResellerApplicationStatus(null)
        setMyOrders([])
        setOrders([])
        setProfiles([])
        setInventory(null)
      }
    })
    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
    // Se ejecuta una sola vez al montar, igual que la versión original.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unitPrice = (p: Product) => Number(isReseller ? p.reseller_price : p.price)
  const cartTotal = cart.reduce((t, item) => t + unitPrice(item.product) * item.quantity, 0)

  function addToCart(p: Product) {
    setCart(current => {
      const found = current.find(item => item.product.id === p.id)
      if (found) return current.map(item => item.product.id === p.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { product: p, quantity: 1 }]
    })
    showToast(`${p.detail || p.name} agregado al carrito`)
  }

  function changeCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart(current => current.filter(item => item.product.id !== productId))
      return
    }
    setCart(current => current.map(item => item.product.id === productId ? { ...item, quantity } : item))
  }

  function openCheckout(initialMessage = '') {
    if (!user) { setModal('login'); return }
    setCheckoutSession(n => n + 1)
    setMessage(initialMessage)
    setModal('checkout')
  }

  const stockByKey = useMemo(() => stockMap(stock), [stock])

  const value: StoreValue = {
    supabase,
    user, isAdmin, isReseller, resellerApplicationStatus, setResellerApplicationStatus,
    loading, setLoading, message, setMessage, toast, showToast, modal, setModal,
    products, banks, myOrders, stock, stockByKey, profiles, orders, allProducts, inventory,
    refreshProducts, refreshMyOrders, refreshAdmin, refreshStock,
    cart, unitPrice, cartTotal, addToCart, changeCartQuantity, clearCart: () => setCart([]),
    checkoutSession, openCheckout, lastOrder, setLastOrder,
    historyUser, setHistoryUser, renewItem, setRenewItem,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
