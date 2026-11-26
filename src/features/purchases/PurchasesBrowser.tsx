// "Mis compras": streaming por plataforma y recargas, con filtros y buscador.
// El cliente y el revendedor ven solo lo suyo; el administrador ve todo
// (mode="admin") y en cada tarjeta aparece quién lo compró.
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { money } from '@/data/catalog'
import { getGameLogo, getStreamingLogo } from '@/data/logos'
import { SUB_STATE_LABEL, platformKey, subState } from '@/features/streaming/streaming'
import { fmtDate, gtDate } from '@/lib/dates'
import { orderStatusLabel } from '@/store/constants'
import { useStore } from '@/store/StoreProvider'
import type { Order } from '@/store/types'
import {
  groupByPlatform, matchRecharge, matchSearch, matchStream, pendingStreamingOrders, platformCountText, purchaseDate,
  rechargePurchases, rechargeState, remainingPct, remainingText, streamingPurchases,
  type Purchase, type RechargeFilter, type StreamFilter,
} from './purchases'

type Props = {
  orders: Order[]
  mode: 'mine' | 'admin'
  /** Contenido al abrir una suscripción (datos de acceso y acciones). */
  renderStreamDetail: (p: Purchase) => ReactNode
  /** Contenido al abrir una recarga (opcional). */
  renderRechargeDetail?: (p: Purchase) => ReactNode
  /** Cuántas tarjetas mostrar antes de "Ver más". */
  pageSize?: number
}

const STREAM_FILTERS: [StreamFilter, string][] = [
  ['recent', '🕒 Recientes'], ['all', '▦ Todas'], ['active', '🟢 Activas'], ['expiring', '🟠 Por vencer'], ['expired', '❌ Vencidas'], ['revoked', '⚪ Finalizadas'],
]
const RECHARGE_FILTERS: [RechargeFilter, string][] = [
  ['recent', '🕒 Recientes'], ['all', '▦ Todas'], ['open', '⏳ En revisión'], ['completed', '✅ Entregadas'], ['rejected', '❌ Rechazadas'],
]
const RECHARGE_BADGE = {
  open: { text: 'En revisión', color: '#ffcc00' },
  completed: { text: 'Entregada', color: '#25d366' },
  rejected: { text: 'Rechazada', color: '#f06675' },
}

const card = { background: '#101e2e', border: '1px solid #194c6c', borderRadius: 14 } as const
const chip = (on: boolean) => ({ className: on ? 'button small' : 'button small secondary', style: { flex: '0 0 auto', borderRadius: 12 } })

function Logo({ src, name, size = 52 }: { src?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size, borderRadius: 12, flex: '0 0 auto', border: '1px solid #194c6c' } as const
  if (src && !broken) return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} style={{ ...box, objectFit: 'cover' }} />
  return (
    <span aria-hidden="true" style={{ ...box, display: 'grid', placeItems: 'center', background: '#0b2a44', color: '#31d6ff', fontWeight: 800, fontSize: size / 2.6 }}>
      {name.trim().slice(0, 2).toUpperCase() || '?'}
    </span>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 12, fontWeight: 700, color, border: `1px solid ${color}55`, background: `${color}1a`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{text}</span>
}

export function PurchasesBrowser({ orders, mode, renderStreamDetail, renderRechargeDetail, pageSize = 30 }: Props) {
  const { products } = useStore()
  const isAdmin = mode === 'admin'
  const [section, setSection] = useState<'stream' | 'recharge'>('stream')
  const [sFilter, setSFilter] = useState<StreamFilter>('all')
  const [rFilter, setRFilter] = useState<RechargeFilter>('all')
  const [platform, setPlatform] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(pageSize)

  const subs = useMemo(() => streamingPurchases(orders), [orders])
  const recharges = useMemo(() => rechargePurchases(orders), [orders])
  const waiting = useMemo(() => pendingStreamingOrders(orders).length, [orders])

  // Logos: el del producto en la tienda; si no tiene, el logo por defecto.
  const logoOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) if (p.image_url && p.game_name && !m.has(platformKey(p.game_name))) m.set(platformKey(p.game_name), p.image_url)
    return (name: string, streaming: boolean) => m.get(platformKey(name)) ?? (streaming ? getStreamingLogo(name) : getGameLogo(name))
  }, [products])

  const term = search.trim()
  const streamCount = (f: StreamFilter) => subs.filter(p => matchStream(p, f)).length
  const rechargeCount = (f: RechargeFilter) => recharges.filter(p => matchRecharge(p, f)).length

  // Con "Todas", sin buscar y sin plataforma elegida, se muestran las plataformas.
  const showPlatformGrid = section === 'stream' && sFilter === 'all' && !platform && !term
  const platforms = useMemo(() => groupByPlatform(subs), [subs])

  const visible = useMemo(() => {
    if (section === 'stream') {
      return subs.filter(p => matchStream(p, sFilter)
        && (!platform || platformKey(p.item.game_name || 'Otra') === platform)
        && matchSearch(p, term, isAdmin))
    }
    return recharges.filter(p => matchRecharge(p, rFilter) && matchSearch(p, term, isAdmin))
  }, [section, subs, recharges, sFilter, rFilter, platform, term, isAdmin])

  const resetView = () => { setOpen(null); setLimit(pageSize) }
  const pickSection = (s: 'stream' | 'recharge') => { setSection(s); setPlatform(null); resetView() }
  const pickStream = (f: StreamFilter) => { setSFilter(f); setPlatform(null); resetView() }
  const pickRecharge = (f: RechargeFilter) => { setRFilter(f); resetView() }
  const platformName = platforms.find(p => p.key === platform)?.name

  const listTitle = term ? 'Resultados' : section === 'stream'
    ? (platformName ? platformName : STREAM_FILTERS.find(([f]) => f === sFilter)?.[1].replace(/^\S+\s/, '') ?? '')
    : RECHARGE_FILTERS.find(([f]) => f === rFilter)?.[1].replace(/^\S+\s/, '') ?? ''

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Sección */}
      <div role="tablist" aria-label="Tipo de compra" style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 6 }}>
        {([['stream', `🎬 Streaming (${subs.length})`], ['recharge', `🎮 Recargas (${recharges.length})`]] as const).map(([s, label]) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} {...chip(section === s)} onClick={() => pickSection(s)}>{label}</button>
        ))}
      </div>

      {/* Filtros */}
      <div role="group" aria-label="Filtrar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {section === 'stream'
          ? STREAM_FILTERS.filter(([f]) => f === 'all' || f === 'recent' || streamCount(f) > 0).map(([f, label]) => (
            <button key={f} type="button" aria-pressed={sFilter === f} {...chip(sFilter === f)} onClick={() => pickStream(f)}>{label} ({streamCount(f)})</button>
          ))
          : RECHARGE_FILTERS.filter(([f]) => f === 'all' || f === 'recent' || rechargeCount(f) > 0).map(([f, label]) => (
            <button key={f} type="button" aria-pressed={rFilter === f} {...chip(rFilter === f)} onClick={() => pickRecharge(f)}>{label} ({rechargeCount(f)})</button>
          ))}
      </div>

      <input aria-label="Buscar en mis compras" value={search}
        onChange={e => {
          // Al buscar se revisa todo: todas las plataformas y estados.
          setSearch(e.target.value); setPlatform(null); setSFilter('all'); setRFilter('all'); resetView()
        }}
        placeholder={section === 'stream'
          ? (isAdmin ? '🔍 Cliente, correo, perfil, PIN o plataforma' : '🔍 Correo, perfil, PIN, plataforma o cliente')
          : (isAdmin ? '🔍 Cliente, juego, ID o referencia' : '🔍 Juego, paquete o ID')} />

      {section === 'stream' && waiting > 0 && (
        <p style={{ fontSize: 13, color: '#ffcc00' }}>⏳ {waiting} pedido{waiting === 1 ? '' : 's'} de streaming en revisión. {isAdmin ? 'Apruébalos en la sección Streaming.' : 'Aparecerán aquí cuando aprobemos el pago.'}</p>
      )}

      {/* Cuadrícula de plataformas */}
      {showPlatformGrid ? (
        <>
          <h4 style={{ margin: '4px 0 0' }}>🎬 Plataformas</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {platforms.map(g => (
              <button key={g.key} type="button" onClick={() => { setPlatform(g.key); resetView() }}
                aria-label={`${g.name}: ${platformCountText(g)}`}
                style={{ ...card, display: 'grid', justifyItems: 'center', gap: 8, padding: '14px 8px', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
                <Logo src={logoOf(g.name, true)} name={g.name} size={64} />
                <strong style={{ textTransform: 'uppercase', fontSize: 14, textAlign: 'center', lineHeight: 1.2 }}>{g.name}</strong>
                <span style={{ fontSize: 12, opacity: 0.75 }}>({platformCountText(g)})</span>
              </button>
            ))}
          </div>
          {platforms.length === 0 && <p>{isAdmin ? 'Aún no hay suscripciones entregadas.' : 'Aún no tienes suscripciones. Cuando compres streaming, aparecerán aquí.'}</p>}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {platform && (
              <button type="button" className="button small secondary" onClick={() => { setPlatform(null); resetView() }}>
                <ArrowLeft size={14} /> Plataformas
              </button>
            )}
            <h4 style={{ margin: 0 }}>{listTitle} ({visible.length})</h4>
          </div>

          {visible.slice(0, limit).map(p => {
            const id = p.item.id
            const isOpen = open === id
            return (
              <div key={id} style={{ ...card, overflow: 'hidden' }}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', font: 'inherit', padding: 12, cursor: 'pointer' }}>
                  {section === 'stream' ? <StreamRow p={p} isAdmin={isAdmin} logo={logoOf(p.item.game_name, true)} open={isOpen} />
                    : <RechargeRow p={p} isAdmin={isAdmin} logo={logoOf(p.item.game_name, false)} open={isOpen} />}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid #194c6c' }}>
                    {section === 'stream' ? renderStreamDetail(p) : (renderRechargeDetail ? renderRechargeDetail(p) : <RechargeDetail p={p} />)}
                  </div>
                )}
              </div>
            )
          })}
          {visible.length > limit && (
            <button type="button" className="button secondary small" onClick={() => setLimit(l => l + pageSize)}>Ver más ({visible.length - limit})</button>
          )}
          {visible.length === 0 && <p style={{ opacity: 0.8 }}>{term ? 'No hay compras que coincidan con tu búsqueda.' : 'No hay compras en esta sección.'}</p>}
        </>
      )}
    </div>
  )
}

function StreamRow({ p, isAdmin, logo, open }: { p: Purchase; isAdmin: boolean; logo?: string; open: boolean }) {
  const { item: it, order: o } = p
  const state = subState(it)
  const badge = SUB_STATE_LABEL[state]
  const pct = remainingPct(it)
  const barColor = state === 'active' ? '#25d366' : state === 'expiring' ? '#ffcc00' : '#f06675'
  const full = /complet/i.test(it.delivery_profile ?? '')
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Logo src={logo} name={it.game_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <strong style={{ textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.game_name}</strong>
            <Badge text={badge.text} color={badge.color} />
          </div>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '2px 0' }}>{full ? 'CUENTA COMPLETA' : `PERFIL · ${it.delivery_profile || '—'}`}</p>
          {isAdmin && <p style={{ fontSize: 13, margin: '2px 0' }}>👤 {o.profiles?.full_name || 'Cliente'}{it.end_customer_name ? ` → ${it.end_customer_name}` : ''}</p>}
          {!isAdmin && it.end_customer_name && <p style={{ fontSize: 13, margin: '2px 0' }}>👤 Para: {it.end_customer_name}</p>}
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>📅 Comprado: {fmtDate(purchaseDate(o))}</p>
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </div>
      {state !== 'revoked' && (
        <div aria-hidden="true" style={{ height: 8, background: '#243449', borderRadius: 8, overflow: 'hidden', margin: '10px 0 6px' }}>
          <div style={{ width: `${Math.max(pct, 3)}%`, height: '100%', background: barColor, borderRadius: 8 }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: state === 'revoked' ? '#8b98a8' : barColor }}>
          {state === 'revoked' ? `Finalizada el ${fmtDate(it.access_revoked_at)}` : `${remainingText(it)} · ${fmtDate(it.valid_until)}`}
        </span>
        <span style={{ fontSize: 13, opacity: 0.8, whiteSpace: 'nowrap' }}>{money(Number(it.unit_price) || 0)}</span>
      </div>
    </>
  )
}

function RechargeRow({ p, isAdmin, logo, open }: { p: Purchase; isAdmin: boolean; logo?: string; open: boolean }) {
  const { item: it, order: o } = p
  const badge = RECHARGE_BADGE[rechargeState(o)]
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Logo src={logo} name={it.game_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <strong style={{ textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.game_name}</strong>
          <Badge text={badge.text} color={badge.color} />
        </div>
        <p style={{ fontSize: 13, opacity: 0.85, margin: '2px 0' }}>{it.quantity > 1 ? `${it.quantity} × ` : ''}{it.product_name}</p>
        {isAdmin && <p style={{ fontSize: 13, margin: '2px 0' }}>👤 {o.profiles?.full_name || 'Cliente'}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, opacity: 0.75 }}>
          <span>📅 {fmtDate(purchaseDate(o))}{it.player_id || o.player_id ? ` · ID ${it.player_id || o.player_id}` : ''}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{money(Number(it.line_total) || 0)}</span>
        </div>
      </div>
      {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
    </div>
  )
}

function RechargeDetail({ p }: { p: Purchase }) {
  const { item: it, order: o } = p
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 14, paddingTop: 10 }}>
      <p>🎮 {it.game_name} · {it.product_name}{it.quantity > 1 ? ` (x${it.quantity})` : ''}</p>
      <p>🆔 {it.contact_type === 'whatsapp' ? 'WhatsApp' : 'ID de jugador'}: <strong>{it.player_id || o.player_id || '—'}</strong></p>
      <p>💰 Total: <strong>{money(Number(it.line_total) || 0)}</strong>{(o.order_items?.length ?? 0) > 1 ? ` (pedido completo ${money(Number(o.amount) || 0)})` : ''}</p>
      <p>🧾 Referencia: {o.reference_nc || '—'}</p>
      <p>📅 Pedido: {fmtDate(gtDate(o.created_at))}{o.completed_at ? ` · Entregado: ${fmtDate(purchaseDate(o))}` : ''}</p>
      <p>Estado: <strong>{orderStatusLabel(o.status)}</strong></p>
    </div>
  )
}
