'use client'

import { useEffect } from 'react'

/**
 * Falha inesperada de renderizacao.
 *
 * Erro tecnico e diferente de erro do exercicio: aqui o vermelho e adequado,
 * a mensagem diz o que aconteceu e oferece uma acao. Nenhum detalhe interno
 * (stack, consulta, caminho de arquivo) e mostrado.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // O digest permite achar a ocorrencia no log do servidor sem expor detalhe.
    console.error('[app] erro de renderização', error.digest)
  }, [error])

  return (
    <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4">
      <div className="border-danger/40 bg-danger-soft text-danger-ink rounded-lg border p-4">
        <h1 className="text-base font-semibold">Não foi possível carregar esta tela</h1>
        <p className="mt-1 text-sm">
          O problema é do nosso lado. Seu progresso não foi perdido.
          {error.digest ? (
            <>
              {' '}
              Código da ocorrência: <span className="font-mono">{error.digest}</span>.
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="bg-accent text-ink-inverse hover:bg-accent-hover inline-flex min-h-11 items-center rounded border border-transparent px-4 text-sm font-medium"
        >
          Tentar de novo
        </button>
        <a
          href="/inicio"
          className="border-line-control bg-surface-raised text-ink hover:bg-surface-sunken inline-flex min-h-11 items-center rounded border px-4 text-sm font-medium"
        >
          Voltar ao início
        </a>
      </div>
    </main>
  )
}
