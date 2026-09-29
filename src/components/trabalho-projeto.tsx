'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { Botao, Cartao, Nota, Progresso, Selo, juntar } from './ui'
import { renderizarInline } from './texto-inline'

/**
 * Acompanhamento de um projeto evolutivo.
 *
 * O projeto cresce por etapas, como software real. A pessoa marca a etapa
 * concluida, guarda o link do repositorio e escreve os campos de portfolio.
 *
 * A plataforma nao gera texto de portfolio no lugar da pessoa nem inventa
 * resultado: o rascunho de divulgacao e apenas um roteiro.
 */

type Etapa = {
  id: string
  order: number
  title: string
  goal: string
  estimatedMinutes: number
  tasks: string[]
  deliverable: string
  acceptance: string[]
  tips: string[]
  moduleIds: string[]
}

type Estado = {
  etapaAtual: number
  concluidas: string[]
  checklist: Record<string, boolean>
  repositorio: string
  deploy: string
  notas: string
  problema: string
  decisoes: string
  dificuldades: string
  aprendizados: string
  publicado: boolean
}

export function TrabalhoProjeto({
  projetoId,
  etapas,
  checklistQualidade,
  rascunhoLinkedin,
  roteiroReadme,
  inicial,
}: {
  projetoId: string
  etapas: Etapa[]
  checklistQualidade: string[]
  rascunhoLinkedin: string
  roteiroReadme: string[]
  inicial: Estado | null
}) {
  const router = useRouter()
  const [iniciado, setIniciado] = useState(inicial !== null)
  const [estado, setEstado] = useState<Estado>(
    inicial ?? {
      etapaAtual: 1,
      concluidas: [],
      checklist: {},
      repositorio: '',
      deploy: '',
      notas: '',
      problema: '',
      decisoes: '',
      dificuldades: '',
      aprendizados: '',
      publicado: false,
    },
  )
  const [aberta, setAberta] = useState<string | null>(inicial ? null : (etapas[0]?.id ?? null))
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const concluidas = new Set(estado.concluidas)
  const percentual = etapas.length === 0 ? 0 : (concluidas.size / etapas.length) * 100

  async function chamar(
    acao: 'iniciar' | 'salvar' | 'concluir-etapa' | 'reabrir-etapa' | 'publicar' | 'despublicar',
    extra?: { etapaId?: string } & Partial<Estado>,
  ) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    setMensagem(null)

    const corpo = { ...estado, ...extra }

    const resposta = await enviar<{
      etapaAtual?: number
      concluidas?: string[]
      publicado?: boolean
    }>(`/api/projetos/${projetoId}`, {
      acao,
      etapaId: extra?.etapaId,
      etapaAtual: corpo.etapaAtual,
      checklist: corpo.checklist,
      repositorio: corpo.repositorio,
      deploy: corpo.deploy,
      notas: corpo.notas,
      problema: corpo.problema,
      decisoes: corpo.decisoes,
      dificuldades: corpo.dificuldades,
      aprendizados: corpo.aprendizados,
    })

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setIniciado(true)
    setEstado((atual) => ({
      ...atual,
      ...extra,
      concluidas: resposta.dados.concluidas ?? atual.concluidas,
      etapaAtual: resposta.dados.etapaAtual ?? atual.etapaAtual,
      publicado: resposta.dados.publicado ?? atual.publicado,
    }))

    if (acao === 'salvar') setMensagem('Salvo.')
    if (acao === 'publicar') setMensagem('Projeto marcado como publicado.')

    router.refresh()
  }

  if (!iniciado) {
    return (
      <Cartao className="space-y-3">
        <p className="text-ink text-sm">
          Este projeto tem {etapas.length} etapas e não termina numa sessão. Cada etapa tem entregável
          próprio, então dá para avançar aos poucos.
        </p>
        {erro ? (
          <p role="alert" className="text-danger-ink text-sm">
            {erro}
          </p>
        ) : null}
        <Botao type="button" variante="primario" onClick={() => chamar('iniciar')} disabled={ocupado}>
          {ocupado ? 'Abrindo…' : 'Começar projeto'}
        </Botao>
      </Cartao>
    )
  }

  const classeEntrada =
    'border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base leading-relaxed'

  return (
    <div className="space-y-4">
      <Cartao className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink text-sm font-medium">
            {concluidas.size} de {etapas.length} etapas
          </p>
          {estado.publicado ? <Selo tom="ok">publicado</Selo> : <Selo tom="accent">em andamento</Selo>}
        </div>
        <Progresso valor={percentual} mostrarNumero={false} />
      </Cartao>

      <ol className="space-y-2">
        {etapas.map((etapa) => {
          const feita = concluidas.has(etapa.id)
          const expandida = aberta === etapa.id

          return (
            <li key={etapa.id}>
              <div
                className={juntar(
                  'border-line bg-surface-raised rounded-lg border',
                  feita && 'opacity-90',
                )}
              >
                <button
                  type="button"
                  onClick={() => setAberta(expandida ? null : etapa.id)}
                  aria-expanded={expandida}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span
                    className={juntar(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                      feita ? 'border-ok/40 bg-ok-soft text-ok-ink' : 'border-line text-ink-faint',
                    )}
                    aria-hidden="true"
                  >
                    {feita ? '✓' : etapa.order}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="text-ink block text-sm font-medium">{etapa.title}</span>
                    <span className="text-ink-muted block text-xs">
                      {etapa.estimatedMinutes} min · {feita ? 'concluída' : 'pendente'}
                    </span>
                  </span>
                </button>

                {expandida ? (
                  <div className="border-line space-y-3 border-t px-4 py-3">
                    <p className="text-ink text-sm leading-relaxed">{renderizarInline(etapa.goal)}</p>

                    <div className="space-y-1">
                      <p className="text-ink-faint text-xs uppercase tracking-wide">Tarefas</p>
                      <ul className="text-ink list-disc space-y-1 pl-5 text-sm">
                        {etapa.tasks.map((tarefa) => (
                          <li key={tarefa} className="leading-relaxed">
                            {renderizarInline(tarefa)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-accent/30 bg-accent-soft space-y-0.5 rounded border p-3">
                      <p className="text-accent-ink text-xs font-medium uppercase tracking-wide">Entregável</p>
                      <p className="text-ink text-sm">{renderizarInline(etapa.deliverable)}</p>
                    </div>

                    {etapa.acceptance.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-ink-faint text-xs uppercase tracking-wide">
                          Como saber que terminou
                        </p>
                        <ul className="text-ink-muted list-disc space-y-1 pl-5 text-sm">
                          {etapa.acceptance.map((item) => (
                            <li key={item} className="leading-relaxed">
                              {renderizarInline(item)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {etapa.tips.length > 0 ? (
                      <Nota titulo="Dicas">
                        <ul className="list-disc space-y-1 pl-5">
                          {etapa.tips.map((dica) => (
                            <li key={dica} className="leading-relaxed">
                              {renderizarInline(dica)}
                            </li>
                          ))}
                        </ul>
                      </Nota>
                    ) : null}

                    <Botao
                      type="button"
                      variante={feita ? 'discreto' : 'primario'}
                      onClick={() => chamar(feita ? 'reabrir-etapa' : 'concluir-etapa', { etapaId: etapa.id })}
                      disabled={ocupado}
                    >
                      {feita ? 'Reabrir etapa' : 'Marcar etapa como concluída'}
                    </Botao>
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <Cartao className="space-y-4">
        <div className="space-y-1">
          <p className="text-ink text-sm font-medium">Portfólio</p>
          <p className="text-ink-muted text-sm">
            Escrito por você. A plataforma não gera texto nem inventa resultado no seu lugar.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="repo" className="text-ink block text-sm font-medium">
              Link do repositório
            </label>
            <input
              id="repo"
              type="url"
              value={estado.repositorio}
              onChange={(evento) => setEstado((atual) => ({ ...atual, repositorio: evento.target.value }))}
              className={classeEntrada}
              placeholder="https://github.com/…"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="deploy" className="text-ink block text-sm font-medium">
              Link do deploy (opcional)
            </label>
            <input
              id="deploy"
              type="url"
              value={estado.deploy}
              onChange={(evento) => setEstado((atual) => ({ ...atual, deploy: evento.target.value }))}
              className={classeEntrada}
              placeholder="https://…"
            />
          </div>
        </div>

        {(
          [
            {
              chave: 'problema' as const,
              rotulo: 'Problema que o projeto resolve',
              ajuda: 'Comece pelo problema, não pela tecnologia. É a primeira coisa que alguém lê.',
            },
            {
              chave: 'decisoes' as const,
              rotulo: 'Decisões técnicas',
              ajuda: 'O que você escolheu, por quê, e o que descartou.',
            },
            {
              chave: 'dificuldades' as const,
              rotulo: 'Dificuldades',
              ajuda: 'O que travou e como você saiu. Isso diferencia mais que a lista de tecnologias.',
            },
            {
              chave: 'aprendizados' as const,
              rotulo: 'Aprendizados',
              ajuda: 'O que você faria diferente hoje.',
            },
          ] satisfies { chave: keyof Estado; rotulo: string; ajuda: string }[]
        ).map((campo) => (
          <div key={campo.chave} className="space-y-1.5">
            <label htmlFor={campo.chave} className="text-ink block text-sm font-medium">
              {campo.rotulo}
            </label>
            <p className="text-ink-muted text-xs">{campo.ajuda}</p>
            <textarea
              id={campo.chave}
              value={String(estado[campo.chave] ?? '')}
              onChange={(evento) =>
                setEstado((atual) => ({ ...atual, [campo.chave]: evento.target.value }) as Estado)
              }
              rows={4}
              className={classeEntrada}
            />
          </div>
        ))}
      </Cartao>

      <Cartao className="space-y-3">
        <div className="space-y-1">
          <p className="text-ink text-sm font-medium">Checklist antes de publicar</p>
          <p className="text-ink-muted text-sm">Marque o que você realmente fez.</p>
        </div>

        <ul className="space-y-0.5">
          {checklistQualidade.map((item) => (
            <li key={item}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                <input
                  type="checkbox"
                  checked={estado.checklist[item] ?? false}
                  onChange={(evento) =>
                    setEstado((atual) => ({
                      ...atual,
                      checklist: { ...atual.checklist, [item]: evento.target.checked },
                    }))
                  }
                  className="accent-accent mt-0.5 h-4 w-4"
                />
                <span className="text-ink text-sm leading-relaxed">{item}</span>
              </label>
            </li>
          ))}
        </ul>

        <p className="text-ink-faint text-xs tabular-nums">
          {Object.values(estado.checklist).filter(Boolean).length} de {checklistQualidade.length} marcados
        </p>
      </Cartao>

      <details className="border-line bg-surface-raised rounded-lg border">
        <summary className="text-ink min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
          Roteiro do README e rascunho para o LinkedIn
        </summary>
        <div className="space-y-3 px-4 pb-4">
          <div className="space-y-1">
            <p className="text-ink-faint text-xs uppercase tracking-wide">Seções do README</p>
            <ol className="text-ink-muted list-decimal space-y-0.5 pl-5 text-sm">
              {roteiroReadme.map((secao) => (
                <li key={secao}>{secao}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-1">
            <p className="text-ink-faint text-xs uppercase tracking-wide">Rascunho de divulgação</p>
            <p className="text-ink-muted text-xs">
              É um exemplo de estrutura. Troque pelos seus números e pela sua experiência — não publique
              afirmação que você não pode sustentar.
            </p>
            <pre className="border-line bg-surface-code text-ink overflow-x-auto rounded border p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {rascunhoLinkedin}
            </pre>
          </div>
        </div>
      </details>

      {mensagem ? <p className="text-ok-ink text-sm">{mensagem}</p> : null}
      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      <div className="border-line bg-surface-raised flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <Botao type="button" variante="secundario" onClick={() => chamar('salvar')} disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </Botao>

        {estado.publicado ? (
          <Botao type="button" variante="discreto" onClick={() => chamar('despublicar')} disabled={ocupado}>
            Desmarcar como publicado
          </Botao>
        ) : (
          <Botao type="button" variante="primario" onClick={() => chamar('publicar')} disabled={ocupado}>
            Marcar como publicado
          </Botao>
        )}
      </div>
    </div>
  )
}
