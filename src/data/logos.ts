// Logos por defecto cuando el producto no tiene image_url propio.
const STORAGE = 'https://naifzdrftwjwbxjxucrj.supabase.co/storage/v1/object/public/Productos'

const GAME_LOGOS: Record<string, string> = {
  freefire: `${STORAGE}/e39a86810c27bc4699a0e50628b2a402.jpg`,
  bloodstrike: `${STORAGE}/9476bb2a4d3910f6c63819d27abd24ef.jpg`,
  roblox: `${STORAGE}/070690595d2dc5c5b20eefbabe9f2748.jpg`,
}

const STREAMING_LOGOS: [string, string][] = [
  ['vix', `${STORAGE}/0b42df5cf388918af778be4f7ff312b9.jpg`],
  ['hbo', `${STORAGE}/17f945ced4b38929ff508de7eab20896.jpg`],
  ['disney', `${STORAGE}/218f5c96502b59b807c5a09654278bca.jpg`],
  ['gemini', `${STORAGE}/74fec7fd0717836050ac638c2a9d083a.jpg`],
  ['paramount', `${STORAGE}/7e130dfd4adeeecf4286bb13c46dcd64.jpg`],
  ['netflix', `${STORAGE}/b2fcf3d6a6c7c5814c0d4c583a16b4e1.jpg`],
  ['youtube', `${STORAGE}/cad6039c053896e2719e664ff6b16705.jpg`],
  ['crunchyroll', `${STORAGE}/da2f1bf098ab7f80a1619eaa49bcfc87.jpg`],
  ['chatgpt', `${STORAGE}/e0434dc50b2e2a87f4a7f5797d5d2432.jpg`],
]

export function getGameLogo(game: string): string | undefined {
  return GAME_LOGOS[game.toLowerCase().replace(/[\s_-]/g, '')]
}

export function getStreamingLogo(name: string): string | undefined {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (n === 'max') return STREAMING_LOGOS.find(([k]) => k === 'hbo')?.[1]
  return STREAMING_LOGOS.find(([k]) => n.startsWith(k))?.[1]
}
