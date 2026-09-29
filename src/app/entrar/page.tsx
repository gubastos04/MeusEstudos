import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { currentUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { FormularioAuth } from '@/components/formulario-auth'

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaEntrar() {
  const usuario = await currentUser()
  if (usuario) redirect(usuario.onboardedAt ? '/inicio' : '/comecar')

  return (
    <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl">Meus Estudos</h1>
        <p className="text-ink-muted text-sm">
          Continue de onde parou. Nada aqui te pune por ter ficado alguns dias fora.
        </p>
      </div>

      <FormularioAuth modo="entrar" />

      <p className="text-ink-muted text-sm">
        <Link href="/recuperar-senha" className="text-accent-ink font-medium underline underline-offset-2">
          Esqueci minha senha
        </Link>
      </p>

      {env().PERMITIR_CADASTRO ? (
        <p className="text-ink-muted text-sm">
          Ainda não tem conta?{' '}
          <Link href="/criar-conta" className="text-accent-ink font-medium underline underline-offset-2">
            Criar conta
          </Link>
        </p>
      ) : null}
    </main>
  )
}
