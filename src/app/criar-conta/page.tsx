import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { currentUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { FormularioAuth } from '@/components/formulario-auth'
import { Nota } from '@/components/ui'

export const metadata: Metadata = { title: 'Criar conta' }

export default async function PaginaCriarConta() {
  const usuario = await currentUser()
  if (usuario) redirect(usuario.onboardedAt ? '/inicio' : '/comecar')

  if (!env().PERMITIR_CADASTRO) {
    return (
      <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
        <h1 className="text-2xl">Cadastros fechados</h1>
        <Nota>Esta instalação não está aceitando novas contas.</Nota>
        <Link href="/entrar" className="text-accent-ink text-sm font-medium underline underline-offset-2">
          Voltar para entrar
        </Link>
      </main>
    )
  }

  return (
    <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl">Criar conta</h1>
        <p className="text-ink-muted text-sm">
          Leva um minuto. Depois, três perguntas rápidas para montar um caminho inicial.
        </p>
      </div>

      <FormularioAuth modo="criar" />

      <p className="text-ink-muted text-sm">
        Já tem conta?{' '}
        <Link href="/entrar" className="text-accent-ink font-medium underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </main>
  )
}
