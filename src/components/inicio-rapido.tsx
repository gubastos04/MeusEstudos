'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { linguagensComuns, perguntas, sugerirTrilha } from '@/lib/onboarding'
import { Escolha, Marcador } from './campos'
import { Botao, Cartao, ErroTecnico, Nota } from './ui'

/**
 * Inicio rapido depois do cadastro (spec 62).
 *
 * Cinco perguntas em passos curtos. Nenhuma tela cheia de campos, nenhuma
 * pergunta obrigatoria alem da primeira, e a sugestao de caminho vem com o
 * motivo escrito — a pessoa pode trocar ali mesmo.
 */

type Trilha = { id: string; title: string; summary: string; forWho: string; naoCobre?: string }

export function InicioRapido({ trilhas }: { trilhas: Trilha[] }) {
  const router = useRouter()
  const [passo, setPasso] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [experiencia, setExperiencia] = useState<string | null>(null)
  const [linguagens, setLinguagens] = useState<string[]>([])
  const [git, setGit] = useState<string>('nunca')
  const [banco, setBanco] = useState<string>('nunca')
  const [minutos, setMinutos] = useState<string>('20')
  const [objetivo, setObjetivo] = useState<string | null>(null)
  const [trilhaEscolhida, setTrilhaEscolhida] = useState<string | null>(null)

  const sugestao =
    experiencia !== null
      ? sugerirTrilha({
          hasProgrammedBefore: experiencia as never,
          usedGit: git as never,
          usedDatabase: banco as never,
          goal: (objetivo ?? undefined) as never,
        })
      : null

  const trilhaSelecionada = trilhaEscolhida ?? sugestao?.trackId ?? null
  const totalPassos = 4

  async function concluir() {
    if (enviando) return
    setEnviando(true)
    setErro(null)

    const resposta = await enviar('/api/onboarding', {
      hasProgrammedBefore: experiencia,
      knownLanguages: linguagens,
      usedGit: git,
      usedDatabase: banco,
      typicalMinutes: Number(minutos),
      goal: objetivo ?? undefined,
      trackId: trilhaSelecionada ?? undefined,
    })

    if (!resposta.ok) {
      setErro(resposta.erro)
      setEnviando(false)
      return
    }

    router.replace('/inicio')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-ink-faint text-xs uppercase tracking-wide">
          Passo {passo + 1} de {totalPassos}
        </p>
        <div className="trilho">
          <span style={{ width: `${((passo + 1) / totalPassos) * 100}%` }} />
        </div>
      </div>

      {erro ? <ErroTecnico descricao={erro} /> : null}

      {passo === 0 ? (
        <div className="space-y-5">
          <Escolha
            rotulo={perguntas.hasProgrammedBefore.rotulo}
            ajuda={perguntas.hasProgrammedBefore.ajuda}
            nome="experiencia"
            valor={experiencia}
            opcoes={[...perguntas.hasProgrammedBefore.opcoes]}
            aoMudar={setExperiencia}
          />

          {experiencia && experiencia !== 'nunca' ? (
            <fieldset className="space-y-2">
              <legend className="text-ink text-sm font-medium">Com quais você já teve contato?</legend>
              <p className="text-ink-muted text-xs">Pode marcar mais de uma, ou nenhuma.</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {linguagensComuns.map((linguagem) => (
                  <Marcador
                    key={linguagem}
                    rotulo={linguagem}
                    marcado={linguagens.includes(linguagem)}
                    aoMudar={(marcado) =>
                      setLinguagens((atual) =>
                        marcado ? [...atual, linguagem] : atual.filter((item) => item !== linguagem),
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {passo === 1 ? (
        <div className="space-y-6">
          <Escolha
            rotulo={perguntas.usedGit.rotulo}
            nome="git"
            valor={git}
            opcoes={[...perguntas.usedGit.opcoes]}
            aoMudar={setGit}
          />
          <Escolha
            rotulo={perguntas.usedDatabase.rotulo}
            nome="banco"
            valor={banco}
            opcoes={[...perguntas.usedDatabase.opcoes]}
            aoMudar={setBanco}
          />
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="space-y-6">
          <Escolha
            rotulo={perguntas.typicalMinutes.rotulo}
            ajuda={perguntas.typicalMinutes.ajuda}
            nome="minutos"
            valor={minutos}
            opcoes={[...perguntas.typicalMinutes.opcoes]}
            aoMudar={setMinutos}
          />
          <Escolha
            rotulo={perguntas.goal.rotulo}
            nome="objetivo"
            valor={objetivo}
            opcoes={[...perguntas.goal.opcoes]}
            aoMudar={setObjetivo}
          />
        </div>
      ) : null}

      {passo === 3 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg">Caminho sugerido</h2>
            {sugestao ? <p className="text-ink-muted text-sm">{sugestao.motivo}</p> : null}
          </div>

          <div className="grid gap-2">
            {trilhas.map((trilha) => {
              const selecionada = trilhaSelecionada === trilha.id
              const sugerida = sugestao?.trackId === trilha.id

              return (
                <label
                  key={trilha.id}
                  className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                    selecionada ? 'border-accent bg-accent-soft' : 'border-line bg-surface-raised'
                  }`}
                >
                  <input
                    type="radio"
                    name="trilha"
                    value={trilha.id}
                    checked={selecionada}
                    onChange={() => setTrilhaEscolhida(trilha.id)}
                    className="accent-accent mt-1"
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink text-sm font-medium">{trilha.title}</span>
                      {sugerida ? (
                        <span className="border-accent/30 bg-accent-soft text-accent-ink rounded border px-1.5 py-0.5 text-[11px]">
                          sugerido
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ink-muted block text-xs">{trilha.summary}</span>
                    <span className="text-ink-faint block text-xs">{trilha.forWho}</span>
                    {/* O que fica de fora aparece ANTES da escolha: depois seria aviso tardio. */}
                    {trilha.naoCobre ? (
                      <span className="text-ink-faint mt-1 block text-xs">{trilha.naoCobre}</span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>

          <Nota>Dá para trocar de caminho quando quiser, no Perfil. Nada fica travado.</Nota>
        </div>
      ) : null}

      <Cartao className="flex items-center justify-between gap-3">
        <Botao
          type="button"
          variante="discreto"
          onClick={() => setPasso((atual) => Math.max(0, atual - 1))}
          disabled={passo === 0 || enviando}
        >
          Voltar
        </Botao>

        {passo < totalPassos - 1 ? (
          <Botao
            type="button"
            variante="primario"
            onClick={() => setPasso((atual) => atual + 1)}
            disabled={passo === 0 && !experiencia}
          >
            Continuar
          </Botao>
        ) : (
          <Botao type="button" variante="primario" onClick={concluir} disabled={enviando || !trilhaSelecionada}>
            {enviando ? 'Salvando…' : 'Começar'}
          </Botao>
        )}
      </Cartao>
    </div>
  )
}
