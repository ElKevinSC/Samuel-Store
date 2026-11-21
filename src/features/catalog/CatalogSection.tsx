import { useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/StoreProvider'
import { CartPanel } from './CartPanel'
import { CategoryGrid } from './CategoryGrid'
import { ProductGrid } from './ProductGrid'

type Section = 'Videojuegos' | 'Streaming'

export function CatalogSection() {
  const { products, user, isReseller, resellerApplicationStatus, setMessage, setModal, refreshProducts, refreshStock } = useStore()
  const [section, setSection] = useState<Section>('Videojuegos')
  const [selectedGame, setSelectedGame] = useState<string | null>(null)

  const logoByGame = useMemo(() => {
    const m = new Map<string, string>()
    for (const pr of products) {
      const g = pr.game_name || 'Otros'
      if (pr.category === section && pr.image_url && !m.has(g)) m.set(g, pr.image_url)
    }
    return m
  }, [products, section])
  const games = useMemo(() => Array.from(new Set(products.filter(p => p.category === section).map(p => p.game_name || 'Otros'))), [products, section])
  const gameProducts = useMemo(() => products.filter(p => p.category === section && (p.game_name || 'Otros') === selectedGame), [products, section, selectedGame])

  return (
    <section className="section catalog wrap" id="catalogo">
      <div className="section-heading">
        <div>
          <h2>{section}<span className="blue-text">.</span></h2>
          {!isReseller && user && (
            <p style={{ fontSize: 12, color: resellerApplicationStatus === 'pending' ? '#25d366' : '#f06675' }}>
              {resellerApplicationStatus === 'pending' ? (
                <>Tu solicitud de revendedor está en revisión. Te avisaremos cuando se apruebe.</>
              ) : resellerApplicationStatus === 'rejected' ? (
                <>Tu solicitud anterior fue rechazada. Contáctanos si deseas volver a solicitar.</>
              ) : (
                <button type="button" onClick={() => { setMessage(''); setModal('reseller_apply') }} style={{ textDecoration: 'underline' }}>
                  Solicita ser revendedor aquí
                </button>
              )}
            </p>
          )}
        </div>
        {selectedGame && <button className="button secondary small" onClick={() => setSelectedGame(null)}><ArrowLeft size={16} /> Volver a juegos</button>}
        <button className="button secondary small" aria-label="Actualizar catálogo" onClick={() => { void refreshProducts(); void refreshStock() }}><RefreshCw size={15} /></button>
        <CartPanel />
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
        {(['Videojuegos', 'Streaming'] as const).map(sec => (
          <button key={sec} className={section === sec ? 'button' : 'button secondary'} onClick={() => { setSection(sec); setSelectedGame(null) }}>{sec}</button>
        ))}
      </div>

      {!selectedGame && <CategoryGrid section={section} games={games} logoByGame={logoByGame} onSelect={setSelectedGame} />}
      {selectedGame && <ProductGrid items={gameProducts} />}
    </section>
  )
}
