'use client'

import Link from 'next/link'
import { useState } from 'react'

import { buscar } from '@/lib/cliente-api'
import { Botao, Carregando, Vazio, juntar } from './ui'

/**
 * Modo "tenho X minutos" (spec 64).
 *
 * Responde a unica pergunta que importa quando a pessoa chega cansada:
 * o que eu consigo fazer agora?
 *
 * Nao existe cronograma, meta diaria nem cobranca. A pessoa diz o tempo que
 * tem naquele momento, e a plataforma adapta a sugestao.
 */

type Sugestao = {
  tipo: string
  id: string
  titulo: string
  motivo: string
  href: string
  minutos: number
  acao: string
  modulo: string | null
}

const opcoes = [
  { minutos: 10, rotulo: 'Tenho 10 minutos' },
  { minutos: 20, rotulo: 'Tenho 20 minutos' },
  { minutos: 45, rotulo: 'Tenho mais tempo' },
] as const

export function TenhoTempo({ minutosPreferidos = 20 }: { minutosPreferidos?: number }) {
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function escolher(minutos: number) {
    setSelecionado(minutos)
    setCarregando(true)
    setErro(null)
    setSugestoes(null)

    const resposta = await buscar<{ sugestoes: Sugestao[] }>(`/api/sugestoes?minutos=${minutos}`)

    setCarregando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setSugestoes(resposta.dados.sugestoes)
  }

  return (
    <section aria-labelledby="tenho-tempo" className="border-line bg-surface-raised space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 id="tenho-tempo" className="text-ink text-base font-semibold">
          Quanto tempo você tem agora?
        </h2>
        <p className="text-ink-muted text-sm">
          A sugestão se ajusta ao tempo. Não é meta e não fica registrado como compromisso.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <Botao
            key={opcao.minutos}
            type="button"
            variante={
              selecionado === opcao.minutos
                ? 'primario'
                : opcao.minutos === minutosPreferidos && selecionado === null
                  ? 'secundario'
                  : 'secundario'
            }
            onClick={() => escolher(opcao.minutos)}
          >
            {opcao.rotulo}
          </Botao>
        ))}
      </div>

      {carregando ? <Carregando linhas={2} /> : null}

      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      {sugestoes && sugestoes.length === 0 ? (
        <Vazio
          titulo="Nada dentro desse tempo agora"
          descricao="Tente um tempo maior, ou abra um módulo direto em Estudar."
        />
      ) : null}

      {sugestoes && sugestoes.length > 0 ? (
        <ul className="space-y-2">
          {sugestoes.map((sugestao) => (
            <li key={`${sugestao.tipo}-${sugestao.id}`}>
              <Link
                href={sugestao.href}
                className={juntar(
                  'border-line bg-surface hover:border-line-strong flex items-start justify-between gap-3 rounded border p-3 transition',
                )}
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="text-ink block text-sm font-medium">{sugestao.titulo}</span>
                  <span className="text-ink-muted block text-xs">{sugestao.motivo}</span>
                  {sugestao.modulo ? (
                    <span className="text-ink-faint block text-xs">{sugestao.modulo}</span>
                  ) : null}
                </span>
                <span className="text-ink-faint shrink-0 text-xs tabular-nums">~{sugestao.minutos} min</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
