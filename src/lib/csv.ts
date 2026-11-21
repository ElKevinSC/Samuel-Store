export function csvCell(v: unknown): string {
  const t = String(v ?? '')
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Descarga filas como CSV separado por ";" con BOM, para que Excel lo abra bien. */
export function downloadCsv(filename: string, rows: string[][]) {
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
