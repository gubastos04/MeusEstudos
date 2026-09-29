'use client'

import { useMemo, useState } from 'react'

import { BlocoCodigo } from './bloco-codigo'
import { renderizarInline } from './texto-inline'
import { Selo, Vazio, juntar } from './ui'

/**
 * Glossario pesquisavel.
 *
 * A busca acontece no cliente porque a lista inteira e pequena e cabe numa
 * resposta: isso deixa o filtro instantaneo e funciona mesmo com a conexao
 * ruim depois do primeiro carregamento.
 */

export type TermoGlossario = {
  id: string
  term: string
  short: string
  explanation: string
  example?: { language: string; code: string } | null
  whereItAppears: string[]
  related: string[]
  tags: string[]
}

export function BuscaGlossario({ termos }: { termos: TermoGlossario[] }) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [tagAtiva, setTagAtiva] = useState<string | null>(null)

  const tags = useMemo(() => {
    const todas = new Set<string>()
    for (const termo of termos) {
      for (const tag of termo.tags) todas.add(tag)
    }
    return [...todas].sort()
  }, [termos])

  const filtrados = useMemo(() => {
    const agulha = busca.trim().toLowerCase()

    return termos.filter((termo) => {
      if (tagAtiva && !termo.tags.includes(tagAtiva)) return false
      if (!agulha) return true

      const palheiro = [termo.term, termo.short, termo.explanation, ...termo.tags, ...termo.related]
        .join(' ')
        .toLowerCase()

      return palheiro.includes(agulha)
    })
  }, [termos, busca, tagAtiva])

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="busca-glossario" className="text-ink block text-sm font-medium">
          Buscar termo
        </label>
        <input
          id="busca-glossario"
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="middleware, índice, idempotência…"
          className="border-line bg-surface-raised text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTagAtiva(null)}
          className={juntar(
            'min-h-8 rounded border px-2.5 text-xs transition',
            tagAtiva === null
              ? 'border-accent bg-accent-soft text-accent-ink'
              : 'border-line bg-surface-raised text-ink-muted hover:text-ink',
          )}
        >
          todos
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTagAtiva(tagAtiva === tag ? null : tag)}
            className={juntar(
              'min-h-8 rounded border px-2.5 text-xs transition',
              tagAtiva === tag
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <p className="text-ink-faint text-xs tabular-nums" aria-live="polite">
        {filtrados.length} {filtrados.length === 1 ? 'termo' : 'termos'}
      </p>

      {filtrados.length === 0 ? (
        <Vazio
          titulo="Nenhum termo encontrado"
          descricao="Tente outra palavra, ou limpe o filtro de categoria."
        />
      ) : (
        <ul className="space-y-2">
          {filtrados.map((termo) => {
            const expandido = aberto === termo.id

            return (
              <li key={termo.id} className="border-line bg-surface-raised rounded-lg border">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : termo.id)}
                  aria-expanded={expandido}
                  className="w-full px-4 py-3 text-left"
                >
                  <span className="text-ink block text-base font-semibold">{termo.term}</span>
                  <span className="text-ink-muted mt-0.5 block text-sm leading-relaxed">{termo.short}</span>
                </button>

                {expandido ? (
                  <div className="border-line space-y-3 border-t px-4 py-3">
                    <p className="text-ink text-sm leading-relaxed">{renderizarInline(termo.explanation)}</p>

                    {termo.example ? (
                      <BlocoCodigo codigo={termo.example.code} linguagem={termo.example.language} />
                    ) : null}

                    {termo.whereItAppears.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-ink-faint text-xs uppercase tracking-wide">Onde aparece</p>
                        <ul className="text-ink-muted list-disc space-y-0.5 pl-5 text-sm">
                          {termo.whereItAppears.map((lugar) => (
                            <li key={lugar}>{lugar}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {termo.related.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-ink-faint text-xs uppercase tracking-wide">Relacionados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {termo.related.map((relacionado) => (
                            <button
                              key={relacionado}
                              type="button"
                              onClick={() => {
                                setBusca(relacionado)
                                setTagAtiva(null)
                                setAberto(null)
                              }}
                              className="border-line bg-surface text-ink-muted hover:text-ink min-h-8 rounded border px-2.5 text-xs transition"
                            >
                              {relacionado}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {termo.tags.map((tag) => (
                        <Selo key={tag}>{tag}</Selo>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
