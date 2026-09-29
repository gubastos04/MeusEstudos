import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { currentUser } from '@/lib/auth'
import { FormularioRecuperar } from '@/components/formulario-senha'

export const metadata: Metadata = { title: 'Recuperar senha' }

export default async function PaginaRecuperarSenha() {
  const usuario = await currentUser()
  if (usuario) redirect('/perfil')

  return (
    <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl">Recuperar senha</h1>
        <p className="text-ink-muted text-sm">
          Informe o email do cadastro. Enviamos um link que vale por 60 minutos e só pode ser usado uma vez.
        </p>
      </div>

      <FormularioRecuperar />
    </main>
  )
}
