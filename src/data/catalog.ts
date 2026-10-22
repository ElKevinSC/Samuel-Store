export type Category = 'Todos' | 'Videojuegos' | 'Streaming' | 'Redes sociales' | 'Reventa'
export interface Product { id: string; name: string; detail: string; category: Category; price: number; resellerPrice: number; art: string; label: string; image_url?: string | null }
// Visual fixtures only. Replace the catalog adapter when a backend is implemented.
export const demoProducts: Product[] = [
  { id: 'ff', name: 'Free Fire', detail: '110 diamantes', category: 'Videojuegos', price: 10, resellerPrice: 8.5, art: 'freefire', label: 'POPULAR' },
  { id: 'netflix', name: 'Netflix', detail: '1 perfil · 30 días', category: 'Streaming', price: 30, resellerPrice: 24, art: 'netflix', label: 'STREAMING' },
  { id: 'pubg', name: 'PUBG Mobile', detail: '60 UC', category: 'Videojuegos', price: 12, resellerPrice: 10, art: 'pubg', label: 'GAMING' },
  { id: 'spotify', name: 'Spotify Premium', detail: 'Individual · 30 días', category: 'Streaming', price: 25, resellerPrice: 20, art: 'spotify', label: 'MÚSICA' },
  { id: 'social', name: 'Diseño para redes', detail: 'Pack de 5 piezas digitales', category: 'Redes sociales', price: 65, resellerPrice: 50, art: 'social', label: 'CREATIVIDAD' },
  { id: 'reseller', name: 'Pack de reventa', detail: 'Paquete digital de ejemplo', category: 'Reventa', price: 100, resellerPrice: 80, art: 'reseller', label: 'REVENDEDORES' },
]
export const money = (amount: number) => `Q ${amount.toFixed(2)}`
