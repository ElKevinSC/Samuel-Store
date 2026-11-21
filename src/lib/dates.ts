// Fechas siempre en hora de Guatemala, en formato AAAA-MM-DD.

export function todayGT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

export function gtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
}

export function prevMonthKey(k: string): string {
  const [y, m] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

export function daysLeft(validUntil: string): number {
  const a = Date.parse(`${validUntil.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${todayGT()}T00:00:00Z`)
  return Math.round((a - b) / 86400000)
}

export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
