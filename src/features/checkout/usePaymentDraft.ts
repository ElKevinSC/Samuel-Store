import { useState } from 'react'

/**
 * Datos del depósito que el cliente va llenando. Se guardan fuera del diálogo
 * para no perderlos al abrir los términos y volver, o al cerrar sin querer.
 * Lo comparten el pago de un pedido y el de una renovación.
 */
export function usePaymentDraft() {
  const [playerId, setPlayerId] = useState('')
  const [reference, setReference] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptService, setAcceptService] = useState(false)

  function reset() {
    setPlayerId('')
    setReference('')
    setDepositDate('')
    setReceipt(null)
    setAcceptTerms(false)
    setAcceptService(false)
  }

  return {
    playerId, setPlayerId, reference, setReference, depositDate, setDepositDate,
    receipt, setReceipt, acceptTerms, setAcceptTerms, acceptService, setAcceptService, reset,
  }
}

export type PaymentDraft = ReturnType<typeof usePaymentDraft>
