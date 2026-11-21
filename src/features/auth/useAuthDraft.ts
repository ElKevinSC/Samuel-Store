import { useState } from 'react'

/** Campos de acceso compartidos entre iniciar sesión, registro y recuperación. */
export function useAuthDraft() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [newPass, setNewPass] = useState('')
  return { email, setEmail, password, setPassword, fullName, setFullName, newPass, setNewPass }
}

export type AuthDraft = ReturnType<typeof useAuthDraft>
