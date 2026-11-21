import type { Supabase } from '@/lib/supabase'

// Comprobantes de pago en el bucket privado "boletas".
const BUCKET = 'boletas'
const MAX_BYTES = 5 * 1024 * 1024
export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const ALLOWED = RECEIPT_ACCEPT.split(',')

/** Devuelve un mensaje de error, o null si el archivo es válido. */
export function receiptProblem(file: File): string | null {
  if (file.size > MAX_BYTES) return 'El comprobante debe pesar máximo 5 MB.'
  if (!ALLOWED.includes(file.type)) return 'Usa JPG, PNG, WEBP o PDF.'
  return null
}

export async function uploadReceipt(sb: Supabase, userId: string, file: File): Promise<{ path: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  return error ? { error: error.message } : { path }
}

export async function removeReceipt(sb: Supabase, path: string) {
  await sb.storage.from(BUCKET).remove([path])
}

export async function signedReceiptUrl(sb: Supabase, path: string): Promise<string | null> {
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}
