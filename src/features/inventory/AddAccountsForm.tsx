// Subir cuentas al inventario: una lista pegada o una cuenta con varios perfiles.
import { useMemo, useState } from 'react'
import { STREAM_TYPE_LABEL, STREAM_TYPE_PLURAL, platformKey } from '@/features/streaming/streaming'
import { useStore } from '@/store/StoreProvider'
import type { StreamType } from '@/store/types'
import { parseAccountList, parseProfilesOfAccount, splitDuplicates } from './inventory'

type Mode = 'list' | 'account'

export function AddAccountsForm() {
  const { supabase, allProducts, inventory, showToast, setMessage, refreshAdmin } = useStore()
  const [platform, setPlatform] = useState('')
  const [type, setType] = useState<StreamType>('profile')
  const [mode, setMode] = useState<Mode>('account')
  const [listText, setListText] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profilesText, setProfilesText] = useState('P1 | \nP2 | \nP3 | \nP4 | \nP5 | ')
  const [saving, setSaving] = useState(false)

  const platforms = useMemo(
    () => Array.from(new Set(allProducts.filter(p => p.category === 'Streaming').map(p => (p.game_name || '').trim()).filter(Boolean))).sort(),
    [allProducts],
  )
  const knownPlatform = !platform.trim() || platforms.some(p => platformKey(p) === platformKey(platform))
  const effectiveMode: Mode = type === 'full' ? 'list' : mode

  const parsed = useMemo(() => {
    if (effectiveMode === 'list') return listText.trim() ? parseAccountList(listText, type) : { rows: [], errors: [] }
    if (!email.trim() && !password.trim()) return { rows: [], errors: [] }
    // Ignora líneas de perfil vacías como "P3 | " sin nombre.
    const lines = profilesText.split(/\r?\n/).filter(l => l.replace(/[|\s]/g, '').length > 0).join('\n')
    return parseProfilesOfAccount(email, password, lines)
  }, [effectiveMode, listText, type, email, password, profilesText])

  const { fresh, duplicates } = useMemo(
    () => splitDuplicates(platform, parsed.rows, inventory ?? []),
    [platform, parsed.rows, inventory],
  )

  async function save() {
    if (inventory === null) {
      showToast('Primero ejecuta la migración de inventario en Supabase.')
      return
    }
    if (!platform.trim()) { showToast('Escribe la plataforma.'); return }
    if (parsed.errors.length) { showToast('Corrige las líneas marcadas antes de guardar.'); return }
    if (fresh.length === 0) { showToast(duplicates ? 'Todas esas cuentas ya están en el inventario.' : 'No hay cuentas para guardar.'); return }
    setSaving(true)
    const rows = fresh.map(r => ({ platform: platform.trim(), stream_type: type, email: r.email, password: r.password, profile_name: r.profile_name, pin: r.pin, status: 'available' }))
    const { error } = await supabase.from('streaming_accounts').insert(rows)
    setSaving(false)
    if (error) {
      setMessage(`No se pudieron guardar las cuentas: ${error.message}`)
      showToast('No se pudieron guardar. Revisa el mensaje al final del panel.')
      return
    }
    showToast(`Se agregaron ${fresh.length} ${type === 'full' ? 'cuenta(s)' : 'perfil(es)'} a ${platform.trim()}.`)
    setListText('')
    setEmail('')
    setPassword('')
    setProfilesText('P1 | \nP2 | \nP3 | \nP4 | \nP5 | ')
    await refreshAdmin()
  }

  return (
    <div className="admin-form" style={{ marginTop: 20 }}>
      <h3>Agregar cuentas al inventario</h3>
      <label>Plataforma
        <input list="ss-streaming-platforms" placeholder="Ej. Netflix" value={platform} onChange={e => setPlatform(e.target.value)} />
        <datalist id="ss-streaming-platforms">{platforms.map(p => <option key={p} value={p} />)}</datalist>
      </label>
      {!knownPlatform && (
        <p style={{ fontSize: 12, color: '#ffcc00' }}>No hay productos de streaming con ese nombre. Escríbelo igual que en Productos para que se entregue automáticamente.</p>
      )}
      <label>Se entrega como
        <select value={type} onChange={e => setType(e.target.value as StreamType)}>
          <option value="profile">Perfil (cada perfil se vende por separado)</option>
          <option value="full">Cuenta completa</option>
        </select>
      </label>

      {type === 'profile' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={mode === 'account' ? 'button small' : 'button small secondary'} onClick={() => setMode('account')}>Una cuenta con varios perfiles</button>
          <button type="button" className={mode === 'list' ? 'button small' : 'button small secondary'} onClick={() => setMode('list')}>Pegar lista</button>
        </div>
      )}

      {effectiveMode === 'account' ? (
        <>
          <input placeholder="Correo de la cuenta" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Contraseña de la cuenta" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} />
          <label>Perfiles: uno por línea, <code>perfil | PIN</code>
            <textarea rows={6} value={profilesText} onChange={e => setProfilesText(e.target.value)} style={{ fontFamily: 'monospace' }} />
          </label>
        </>
      ) : (
        <label>
          Una por línea: <code>{type === 'full' ? 'correo | contraseña' : 'correo | contraseña | perfil | PIN'}</code>
          <textarea
            rows={7}
            value={listText}
            onChange={e => setListText(e.target.value)}
            placeholder={type === 'full' ? 'cuenta1@correo.com | clave123\ncuenta2@correo.com | clave456' : 'cuenta1@correo.com | clave123 | P1 | 1234\ncuenta1@correo.com | clave123 | P2 | 5678'}
            style={{ fontFamily: 'monospace' }}
          />
          <small style={{ opacity: 0.7 }}>También puedes pegar columnas copiadas de Excel (separadas por tabulador).</small>
        </label>
      )}

      {(parsed.rows.length > 0 || parsed.errors.length > 0) && (
        <div style={{ background: '#111', padding: 10, borderRadius: 8, fontSize: 13 }}>
          <p>Se agregarán <strong>{fresh.length}</strong> {fresh.length === 1 ? STREAM_TYPE_LABEL[type].toLowerCase() : STREAM_TYPE_PLURAL[type]}{platform.trim() ? ` de ${platform.trim()}` : ''}.</p>
          {duplicates > 0 && <p style={{ color: '#ffcc00' }}>{duplicates} ya estaba{duplicates === 1 ? '' : 'n'} en el inventario y se omite{duplicates === 1 ? '' : 'n'}.</p>}
          {parsed.errors.slice(0, 6).map(e => <p key={e} style={{ color: '#f06675' }}>{e}</p>)}
          {parsed.errors.length > 6 && <p style={{ color: '#f06675' }}>…y {parsed.errors.length - 6} errores más.</p>}
        </div>
      )}

      <button className="button" disabled={saving} onClick={() => { void save() }}>{saving ? 'Guardando…' : 'Guardar en inventario'}</button>
    </div>
  )
}
