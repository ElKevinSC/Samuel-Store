export const STORE_WHATSAPP = '50254560623'

/** Deja solo dígitos; un número de 8 dígitos se toma como de Guatemala (502). */
export function waDigits(v: string): string {
  const d = v.replace(/\D/g, '')
  return d.length === 8 ? `502${d}` : d
}

/** Enlace para escribir a un número concreto. */
export function waLinkTo(number: string, text: string): string {
  return `https://wa.me/${waDigits(number)}?text=${encodeURIComponent(text)}`
}

/** Enlace sin número: WhatsApp deja elegir el contacto al que se reenvía. */
export function waShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Escribe al número si existe; si no, deja elegir el contacto. */
export function waLinkOrShare(number: string | null | undefined, text: string): string {
  return number && waDigits(number).length >= 8 ? waLinkTo(number, text) : waShare(text)
}
