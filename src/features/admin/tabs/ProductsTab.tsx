// Crear y editar productos, y qué dato pide cada juego o plataforma.
import { useState } from 'react'
import { money } from '@/data/catalog'
import { STREAM_TYPE_LABEL, streamTypeOf } from '@/features/streaming/streaming'
import { useStore } from '@/store/StoreProvider'
import type { Product, StreamType } from '@/store/types'
import type { AdminData } from '../useAdminData'

type Section = 'Videojuegos' | 'Streaming'
type Contact = 'player_id' | 'whatsapp'
const emptyDraft = { game_name: '', name: '', price: '', reseller_price: '', duration_days: '', active: true, image_url: '', stream_type: 'profile' as StreamType }

const checkboxStyle = { width: 22, height: 22, minWidth: 22, margin: 0, padding: 0, flex: '0 0 22px' }

export function ProductsTab({ data }: { data: AdminData }) {
  const { supabase, isAdmin, loading, setLoading, setMessage, showToast, refreshProducts, refreshAdmin } = useStore()
  const { productGroups, contactRows } = data

  // Crear
  const [newCategory, setNewCategory] = useState<Section>('Videojuegos')
  const [newContact, setNewContact] = useState<Contact>('player_id')
  const [newDuration, setNewDuration] = useState('30')
  const [newStreamType, setNewStreamType] = useState<StreamType>('profile')
  const [gameName, setGameName] = useState('')
  const [packageName, setPackageName] = useState('')
  const [newType, setNewType] = useState('')
  const [newLogo, setNewLogo] = useState('')
  const [price, setPrice] = useState('')
  const [resellerPrice, setResellerPrice] = useState('')
  // Editar
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState(emptyDraft)

  async function saveProduct() {
    if (!isAdmin) return
    const isStreamNew = newCategory === 'Streaming'
    const days = Number(newDuration || 0)
    if (!gameName.trim() || (!isStreamNew && !packageName.trim()) || (isStreamNew && days < 1) || Number(price) <= 0) {
      setMessage(isStreamNew ? 'Escribe la plataforma, la duración en días y un precio válido.' : 'Escribe juego, paquete y precio válido.')
      return
    }
    const newLogoUrl = newLogo.trim()
    if (newLogoUrl && !/^https:\/\//i.test(newLogoUrl)) {
      setMessage('El enlace del logo debe empezar con https://')
      return
    }
    const productLabel = isStreamNew ? (newType.trim() ? `${gameName.trim()} – ${newType.trim()} (${days} días)` : `${gameName.trim()} – ${days} días`) : packageName.trim()
    setLoading(true)
    const { error } = await supabase.from('products').insert({
      name: productLabel,
      detail: productLabel,
      game_name: gameName.trim(),
      category: newCategory,
      contact_type: newContact,
      duration_days: isStreamNew ? days : null,
      image_url: newLogoUrl || null,
      price: Number(price),
      reseller_price: Number(resellerPrice || price),
      active: true,
      ...(isStreamNew ? { stream_type: newStreamType } : {}),
    })
    setLoading(false)
    if (error) setMessage(`Error al guardar producto: ${error.message}`)
    else {
      setMessage('Producto guardado.')
      setGameName('')
      setPackageName('')
      setNewType('')
      setNewLogo('')
      setPrice('')
      setResellerPrice('')
      await refreshProducts()
      await refreshAdmin()
    }
  }

  function startEdit(pr: Product) {
    setEditingId(pr.id)
    setEditDraft({
      game_name: pr.game_name || '',
      name: pr.detail || pr.name,
      price: String(pr.price),
      reseller_price: String(pr.reseller_price),
      duration_days: pr.duration_days ? String(pr.duration_days) : '',
      active: pr.active,
      image_url: pr.image_url || '',
      stream_type: streamTypeOf(pr),
    })
  }

  async function saveEdit(pr: Product) {
    if (!isAdmin) return
    const priceN = Number(editDraft.price)
    const resellerN = Number(editDraft.reseller_price)
    const days = Number(editDraft.duration_days)
    if (!editDraft.game_name.trim() || !editDraft.name.trim() || !(priceN > 0) || !(resellerN > 0)) {
      showToast('Completa plataforma o juego, nombre y precios mayores a 0.')
      return
    }
    if (pr.category === 'Streaming' && !(days >= 1)) {
      showToast('Escribe la duración en días.')
      return
    }
    const logoUrl = editDraft.image_url.trim()
    if (logoUrl && !/^https:\/\//i.test(logoUrl)) {
      showToast('El enlace del logo debe empezar con https://')
      return
    }
    const patch: Record<string, string | number | boolean | null> = {
      game_name: editDraft.game_name.trim(),
      name: editDraft.name.trim(),
      detail: editDraft.name.trim(),
      price: priceN,
      reseller_price: resellerN,
      active: editDraft.active,
      image_url: logoUrl || null,
    }
    if (pr.category === 'Streaming') {
      patch.duration_days = days
      patch.stream_type = editDraft.stream_type
    }
    const { error } = await supabase.from('products').update(patch).eq('id', pr.id)
    if (error) {
      showToast(`No se pudo guardar: ${error.message}`)
      return
    }
    if (logoUrl !== (pr.image_url || '')) {
      await supabase.from('products').update({ image_url: logoUrl || null }).eq('category', pr.category).eq('game_name', editDraft.game_name.trim())
    }
    showToast('Producto actualizado')
    setEditingId(null)
    await refreshProducts()
    await refreshAdmin()
  }

  async function setGameContact(category: string, game: string, value: string) {
    if (!isAdmin) return
    const { error } = await supabase.from('products').update({ contact_type: value }).eq('category', category).eq('game_name', game)
    if (error) showToast(`No se pudo cambiar: ${error.message}`)
    else {
      showToast('Guardado')
      await refreshProducts()
    }
  }

  return (
    <>
      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Crear juego / paquete</h3>
        <label>Sección<select value={newCategory} onChange={e => { const v = e.target.value as Section; setNewCategory(v); setNewContact(v === 'Streaming' ? 'whatsapp' : 'player_id') }}><option value="Videojuegos">Videojuegos</option><option value="Streaming">Streaming</option></select></label>
        <label>El cliente debe dar<select value={newContact} onChange={e => setNewContact(e.target.value as Contact)}><option value="player_id">ID de jugador</option><option value="whatsapp">Número de WhatsApp</option></select></label>
        {newCategory === 'Streaming' && <input type="number" min="1" placeholder="Duración en días (Ej. 30)" value={newDuration} onChange={e => setNewDuration(e.target.value)} />}
        <input placeholder={newCategory === 'Streaming' ? 'Plataforma (Ej. Disney)' : 'Nombre del juego (Ej. Free Fire)'} value={gameName} onChange={e => setGameName(e.target.value)} />
        {newCategory === 'Videojuegos' && <input placeholder="Nombre del paquete (Ej. 1000 Diamantes)" value={packageName} onChange={e => setPackageName(e.target.value)} />}
        {newCategory === 'Streaming' && (
          <label>Se entrega desde el inventario como
            <select value={newStreamType} onChange={e => { const v = e.target.value as StreamType; setNewStreamType(v); if (!newType.trim() || newType === STREAM_TYPE_LABEL.profile || newType === STREAM_TYPE_LABEL.full) setNewType(STREAM_TYPE_LABEL[v]) }}>
              <option value="profile">Perfil</option>
              <option value="full">Cuenta completa</option>
            </select>
          </label>
        )}
        {newCategory === 'Streaming' && <input placeholder="Tipo (opcional, Ej. Perfil, Cuenta completa)" value={newType} onChange={e => setNewType(e.target.value)} />}
        <input placeholder="Logo (enlace https de la imagen, opcional)" value={newLogo} onChange={e => setNewLogo(e.target.value)} />
        {newCategory === 'Streaming' && <p style={{ fontSize: 12, opacity: 0.8 }}>El cliente verá: {gameName.trim() || 'Plataforma'} – {newType.trim() ? `${newType.trim()} (${newDuration || '…'} días)` : `${newDuration || '…'} días`}. La cuenta se toma sola del inventario de {gameName.trim() || 'la plataforma'} ({STREAM_TYPE_LABEL[newStreamType].toLowerCase()}) al aprobar el pago.</p>}
        <input type="number" min="0.01" step="0.01" placeholder="Precio cliente (Q)" value={price} onChange={e => setPrice(e.target.value)} />
        <input type="number" min="0" step="0.01" placeholder="Precio revendedor (Q)" value={resellerPrice} onChange={e => setResellerPrice(e.target.value)} />
        <button className="button" disabled={loading} onClick={() => { void saveProduct() }}>Guardar producto</button>
      </div>

      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Editar productos</h3>
        <p style={{ fontSize: 12, opacity: 0.8 }}>Cambia nombres y precios. Los pedidos ya hechos no cambian; los precios nuevos aplican a compras y renovaciones nuevas. Para unir dos plataformas, ponles el mismo nombre en "Plataforma o juego".</p>
        <div style={{ maxHeight: '70dvh', overflowY: 'auto' }}>
          {productGroups.map(g => (
            <div key={g.key} style={{ margin: '12px 0' }}>
              <strong>{g.game} <small>({g.category})</small></strong>
              {g.items.map(pr => (
                <div key={pr.id} style={{ background: '#222', padding: 10, margin: '6px 0', borderRadius: 8, opacity: pr.active ? 1 : 0.6 }}>
                  {editingId === pr.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label>Plataforma o juego<input value={editDraft.game_name} onChange={e => setEditDraft(d => ({ ...d, game_name: e.target.value }))} /></label>
                      <label>Nombre del paquete<input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} /></label>
                      <label>Logo (enlace https, opcional)<input value={editDraft.image_url} onChange={e => setEditDraft(d => ({ ...d, image_url: e.target.value }))} /></label>
                      <label>Precio cliente (Q)<input type="number" min="0.01" step="0.01" value={editDraft.price} onChange={e => setEditDraft(d => ({ ...d, price: e.target.value }))} /></label>
                      <label>Precio revendedor (Q)<input type="number" min="0.01" step="0.01" value={editDraft.reseller_price} onChange={e => setEditDraft(d => ({ ...d, reseller_price: e.target.value }))} /></label>
                      {pr.category === 'Streaming' && <label>Duración (días)<input type="number" min="1" value={editDraft.duration_days} onChange={e => setEditDraft(d => ({ ...d, duration_days: e.target.value }))} /></label>}
                      {pr.category === 'Streaming' && (
                        <label>Se entrega como
                          <select value={editDraft.stream_type} onChange={e => setEditDraft(d => ({ ...d, stream_type: e.target.value as StreamType }))}>
                            <option value="profile">Perfil</option>
                            <option value="full">Cuenta completa</option>
                          </select>
                        </label>
                      )}
                      <label style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <input type="checkbox" checked={editDraft.active} onChange={e => setEditDraft(d => ({ ...d, active: e.target.checked }))} style={checkboxStyle} />
                        <span>Visible en la tienda</span>
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button small" onClick={() => { void saveEdit(pr) }}>Guardar</button>
                        <button className="button secondary small" onClick={() => setEditingId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div>
                        <strong>{pr.detail || pr.name}</strong>
                        <p style={{ fontSize: 13 }}>
                          Cliente {money(Number(pr.price))} | Revendedor {money(Number(pr.reseller_price))}
                          {pr.category === 'Streaming' ? ` | ${STREAM_TYPE_LABEL[streamTypeOf(pr)]}` : ''}
                          {pr.active ? '' : ' | Oculto'}
                        </p>
                      </div>
                      <button className="button small" onClick={() => startEdit(pr)}>Editar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {productGroups.length === 0 && <p>Aún no hay productos.</p>}
        </div>
      </div>

      <div className="admin-form" style={{ marginTop: 20 }}>
        <h3>Qué datos pide cada juego o plataforma</h3>
        {contactRows.map(r => (
          <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <span>{r.game} <small>({r.category})</small></span>
            <select value={r.contact} onChange={e => { void setGameContact(r.category, r.game, e.target.value) }}>
              <option value="player_id">ID de jugador</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        ))}
        {contactRows.length === 0 && <p>Aún no hay productos.</p>}
      </div>
    </>
  )
}
