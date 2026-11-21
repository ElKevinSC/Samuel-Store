import { Gamepad2, Tv } from 'lucide-react'
import { getGameLogo, getStreamingLogo } from '@/data/logos'

type Props = {
  section: 'Videojuegos' | 'Streaming'
  games: string[]
  logoByGame: Map<string, string>
  onSelect: (game: string) => void
}

/** Tarjetas de juegos o plataformas de la sección elegida. */
export function CategoryGrid({ section, games, logoByGame, onSelect }: Props) {
  return (
    <div className="category-grid">
      {games.length === 0 ? (
        <p style={{ color: 'gray' }}>Todavía no hay {section === 'Streaming' ? 'plataformas' : 'juegos'} disponibles.</p>
      ) : (
        games.map(game => {
          const logo = logoByGame.get(game) ?? (section === 'Videojuegos' ? getGameLogo(game) : getStreamingLogo(game))
          return (
            <button key={game} className="category-card" onClick={() => onSelect(game)}>
              <span className="category-icon" style={{ width: 76, height: 76, overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: 12 }}>
                {logo ? (
                  <img src={logo} alt={`Logo de ${game}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 12 }} />
                ) : (
                  section === 'Streaming' ? <Tv size={27} /> : <Gamepad2 size={27} />
                )}
              </span>
              <h3>{game}</h3>
              <p>{section === 'Streaming' ? 'Ver perfiles disponibles' : 'Ver paquetes de recarga'}</p>
            </button>
          )
        })
      )}
    </div>
  )
}
