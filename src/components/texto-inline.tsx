import type { ReactNode } from 'react'

/**
 * Marcacao inline simples do conteudo.
 *
 * Suporta `codigo`, **forte** e [texto](url).
 *
 * Decisao de seguranca: o texto do conteudo NUNCA vira HTML. Nada aqui usa
 * dangerouslySetInnerHTML — a funcao devolve elementos React, entao qualquer
 * coisa que nao case com os padroes acima aparece como texto literal.
 */

const PADRAO = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g

export function TextoInline({ texto }: { texto: string }) {
  return <>{renderizarInline(texto)}</>
}

export function renderizarInline(texto: string): ReactNode[] {
  const partes: ReactNode[] = []
  let ultimo = 0
  let chave = 0

  for (const encontrado of texto.matchAll(PADRAO)) {
    const inicio = encontrado.index ?? 0
    if (inicio > ultimo) {
      partes.push(texto.slice(ultimo, inicio))
    }

    const bruto = encontrado[0]

    if (bruto.startsWith('`')) {
      partes.push(
        <code
          key={chave++}
          className="bg-surface-sunken text-ink rounded px-1 py-0.5 text-[0.9em] break-words"
        >
          {bruto.slice(1, -1)}
        </code>,
      )
    } else if (bruto.startsWith('**')) {
      partes.push(
        <strong key={chave++} className="text-ink font-semibold">
          {bruto.slice(2, -2)}
        </strong>,
      )
    } else {
      const separador = bruto.indexOf('](')
      const rotulo = bruto.slice(1, separador)
      const destino = bruto.slice(separador + 2, -1)
      const externo = /^https?:\/\//i.test(destino)

      partes.push(
        <a
          key={chave++}
          href={destino}
          className="text-accent-ink underline underline-offset-2"
          {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {rotulo}
          {externo ? <span className="sr-only"> (abre em nova aba)</span> : null}
        </a>,
      )
    }

    ultimo = inicio + bruto.length
  }

  if (ultimo < texto.length) {
    partes.push(texto.slice(ultimo))
  }

  return partes
}
