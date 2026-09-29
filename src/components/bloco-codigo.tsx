'use client'

import { useState } from 'react'

import { juntar } from './ui'

/**
 * Bloco de codigo.
 *
 * Rola na horizontal de proposito: quebrar linha de codigo muda o sentido.
 * O botao de copiar evita a pessoa precisar selecionar com o dedo no celular.
 */

const rotulos: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  bash: 'Terminal',
  json: 'JSON',
  yaml: 'YAML',
  java: 'Java',
  php: 'PHP',
  diff: 'Diff',
  text: '',
}

export function BlocoCodigo({
  codigo,
  linguagem = 'text',
  legenda,
  destaque = [],
}: {
  codigo: string
  linguagem?: string
  legenda?: string
  destaque?: number[]
}) {
  const [copiado, setCopiado] = useState(false)
  const linhas = codigo.replace(/\n$/, '').split('\n')
  const destacadas = new Set(destaque)
  const rotulo = rotulos[linguagem] ?? linguagem

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sem permissao de area de transferencia: a pessoa ainda pode selecionar.
      setCopiado(false)
    }
  }

  return (
    <figure className="border-line bg-surface-code overflow-hidden rounded-lg border">
      <div className="border-line bg-surface-sunken flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-ink-faint text-xs font-medium">{rotulo}</span>
        <button
          type="button"
          onClick={copiar}
          className="text-ink-muted hover:text-ink min-h-8 rounded px-2 text-xs transition"
        >
          {copiado ? 'copiado' : 'copiar'}
        </button>
      </div>

      <pre className="text-ink overflow-x-auto py-3 text-[13px] leading-relaxed">
        <code>
          {linhas.map((linha, indice) => (
            <span
              key={indice}
              className={juntar(
                'block px-3',
                destacadas.has(indice + 1) && 'bg-warn-soft border-warn border-l-2 pl-[10px]',
              )}
            >
              {linha || ' '}
            </span>
          ))}
        </code>
      </pre>

      {legenda ? (
        <figcaption className="border-line text-ink-muted border-t px-3 py-2 text-xs">{legenda}</figcaption>
      ) : null}
    </figure>
  )
}

/** Saida de terminal: visual proprio para nao ser confundido com codigo-fonte. */
export function BlocoTerminal({ linhas, legenda }: { linhas: string[]; legenda?: string }) {
  return (
    <figure className="border-line bg-surface-code overflow-hidden rounded-lg border">
      <div className="border-line bg-surface-sunken border-b px-3 py-1.5">
        <span className="text-ink-faint text-xs font-medium">Terminal</span>
      </div>
      <pre className="text-ink-muted overflow-x-auto px-3 py-3 text-[13px] leading-relaxed">
        <code>
          {linhas.map((linha, indice) => (
            <span
              key={indice}
              className={juntar('block', linha.startsWith('$') || linha.startsWith('>') ? 'text-ink' : undefined)}
            >
              {linha || ' '}
            </span>
          ))}
        </code>
      </pre>
      {legenda ? (
        <figcaption className="border-line text-ink-muted border-t px-3 py-2 text-xs">{legenda}</figcaption>
      ) : null}
    </figure>
  )
}
