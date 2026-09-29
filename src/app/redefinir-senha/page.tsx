import type { Metadata } from 'next'
import Link from 'next/link'

import { tokenUtilizavel } from '@/lib/redefinicao-senha'
import { FormularioRedefinir } from '@/components/formulario-senha'
import { Aviso } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Redefinir senha',
  // O link contém o token: mantê-lo fora de buscadores e de referrer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type Props = { searchParams: Promise<{ token?: string }> }

export default async function PaginaRedefinirSenha({ searchParams }: Props) {
  const { token = '' } = await searchParams

  // Verificar antes de mostrar o formulário evita a pessoa digitar a senha
  // nova duas vezes para só então descobrir que o link venceu.
  const valido = await tokenUtilizavel(token)

  return (
    <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl">Definir nova senha</h1>
        {valido ? (
          <p className="text-ink-muted text-sm">
            Escolha uma senha nova. Ao concluir, as sessões abertas em outros dispositivos são encerradas.
          </p>
        ) : null}
      </div>

      {valido ? (
        <FormularioRedefinir token={token} />
      ) : (
        <div className="space-y-4">
          <Aviso titulo="Este link não vale mais">
            Links de redefinição valem por 60 minutos e só podem ser usados uma vez. Pedir um novo leva
            alguns segundos.
          </Aviso>

          <Link
            href="/recuperar-senha"
            className="bg-accent text-ink-inverse hover:bg-accent-hover inline-flex min-h-11 w-full items-center justify-center rounded border border-transparent px-4 text-sm font-medium"
          >
            Pedir um link novo
          </Link>

          <Link href="/entrar" className="text-accent-ink block text-sm font-medium underline underline-offset-2">
            Voltar para entrar
          </Link>
        </div>
      )}
    </main>
  )
}
