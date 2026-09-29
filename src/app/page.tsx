import { redirect } from 'next/navigation'

import { currentUser } from '@/lib/auth'

/** Raiz: leva direto para onde a pessoa precisa estar. */
export default async function Raiz() {
  const usuario = await currentUser()

  if (!usuario) redirect('/entrar')
  redirect(usuario.onboardedAt ? '/inicio' : '/comecar')
}
