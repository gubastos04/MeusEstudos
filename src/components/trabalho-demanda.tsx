'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { Botao, Cartao, Nota, Selo, juntar } from './ui'

/**
 * Area de trabalho de uma demanda.
 *
 * Reproduz o caminho de uma tarefa real: entender, planejar, implementar,
 * testar, registrar e abrir o "PR". Cada campo e salvo no servidor, entao a
 * pessoa pode fechar no meio e continuar em outro dispositivo.
 *
 * Os critérios de aceite sao marcados manualmente. A plataforma nao finge
 * validar automaticamente o que dependeria de rodar o sistema da demanda.
 */

type Estado = {
  status: string
  entendimento: string
  plano: string
  solucao: string
  notasDeTeste: string
  repositorio: string
  branch: string
  tituloPr: string
  corpoPr: string
  aceite: boolean[]
  autoRevisao: string
}

const etapas = [
  { chave: 'analisando', rotulo: 'Analisando' },
  { chave: 'implementando', rotulo: 'Implementando' },
  { chave: 'revisando', rotulo: 'Revisando' },
] as const

export function TrabalhoDemanda({
  demandaId,
  criterios,
  checklistRevisao,
  inicial,
}: {
  demandaId: string
  criterios: string[]
  checklistRevisao: string[]
  inicial: Estado | null
}) {
  const router = useRouter()
  const [iniciado, setIniciado] = useState(inicial !== null)
  const [estado, setEstado] = useState<Estado>(
    inicial ?? {
      status: 'analisando',
      entendimento: '',
      plano: '',
      solucao: '',
      notasDeTeste: '',
      repositorio: '',
      branch: '',
      tituloPr: '',
      corpoPr: '',
      aceite: criterios.map(() => false),
      autoRevisao: '',
    },
  )
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const concluida = estado.status === 'concluida'
  const aceiteCompleto = estado.aceite.length > 0 && estado.aceite.every(Boolean)

  async function chamar(acao: 'iniciar' | 'salvar' | 'concluir' | 'abandonar', extra?: Partial<Estado>) {
    if (salvando) return
    setSalvando(true)
    setErro(null)
    setMensagem(null)

    const corpo = { ...estado, ...extra }

    const resposta = await enviar<{ status: string }>(`/api/demandas/${demandaId}`, {
      acao,
      status: acao === 'salvar' ? corpo.status : undefined,
      entendimento: corpo.entendimento,
      plano: corpo.plano,
      solucao: corpo.solucao,
      notasDeTeste: corpo.notasDeTeste,
      repositorio: corpo.repositorio,
      branch: corpo.branch,
      tituloPr: corpo.tituloPr,
      corpoPr: corpo.corpoPr,
      aceite: corpo.aceite,
      autoRevisao: corpo.autoRevisao,
    })

    setSalvando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setEstado((atual) => ({ ...atual, ...extra, status: resposta.dados.status }))
    setIniciado(true)

    if (acao === 'salvar') setMensagem('Salvo.')
    if (acao === 'concluir') setMensagem('Demanda marcada como concluída.')
    if (acao === 'abandonar') setMensagem('Demanda marcada como parada. Você pode retomar quando quiser.')

    router.refresh()
  }

  if (!iniciado) {
    return (
      <Cartao className="space-y-3">
        <p className="text-ink text-sm">
          Ao começar, você ganha um espaço para registrar o que entendeu, o que planejou, o que fez e como
          testou. Dá para parar no meio e voltar depois.
        </p>
        {erro ? (
          <p role="alert" className="text-danger-ink text-sm">
            {erro}
          </p>
        ) : null}
        <Botao type="button" variante="primario" onClick={() => chamar('iniciar')} disabled={salvando}>
          {salvando ? 'Abrindo…' : 'Pegar esta demanda'}
        </Botao>
      </Cartao>
    )
  }

  const classeEntrada =
    'border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base leading-relaxed'

  return (
    <div className="space-y-4">
      <Cartao className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink text-sm font-medium">Situação</p>
          {concluida ? <Selo tom="ok">concluída</Selo> : <Selo tom="accent">{estado.status}</Selo>}
        </div>

        {!concluida ? (
          <div className="flex flex-wrap gap-1.5">
            {etapas.map((etapa) => (
              <button
                key={etapa.chave}
                type="button"
                onClick={() => chamar('salvar', { status: etapa.chave })}
                className={juntar(
                  'min-h-9 rounded border px-2.5 text-sm transition',
                  estado.status === etapa.chave
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {etapa.rotulo}
              </button>
            ))}
          </div>
        ) : null}
      </Cartao>

      <Cartao className="space-y-4">
        <Campo
          id="entendimento"
          rotulo="1. O que está sendo pedido, com suas palavras"
          ajuda="Se você não consegue escrever, ainda não entendeu. Escreva também as dúvidas que faria a quem pediu."
          valor={estado.entendimento}
          aoMudar={(valor) => setEstado((atual) => ({ ...atual, entendimento: valor }))}
          linhas={4}
          classe={classeEntrada}
        />

        <Campo
          id="plano"
          rotulo="2. Como você pretende resolver"
          ajuda="Quebre em partes pequenas, com fim observável. Antes de escrever código."
          valor={estado.plano}
          aoMudar={(valor) => setEstado((atual) => ({ ...atual, plano: valor }))}
          linhas={5}
          classe={classeEntrada}
        />

        <Campo
          id="solucao"
          rotulo="3. O que você fez"
          ajuda="Cole o código, o comando ou a consulta. Este é o registro técnico da demanda."
          valor={estado.solucao}
          aoMudar={(valor) => setEstado((atual) => ({ ...atual, solucao: valor }))}
          linhas={8}
          classe={juntar(classeEntrada, 'font-mono text-[13px]')}
        />

        <Campo
          id="testes"
          rotulo="4. Como você testou"
          ajuda="Quais casos você verificou, incluindo os de borda. E o que ainda não testou."
          valor={estado.notasDeTeste}
          aoMudar={(valor) => setEstado((atual) => ({ ...atual, notasDeTeste: valor }))}
          linhas={4}
          classe={classeEntrada}
        />
      </Cartao>

      {criterios.length > 0 ? (
        <Cartao className="space-y-3">
          <div className="space-y-1">
            <p className="text-ink text-sm font-medium">Critérios de aceite</p>
            <p className="text-ink-muted text-sm">Seja honesto aqui. O registro só serve se for verdade.</p>
          </div>

          <ul className="space-y-1">
            {criterios.map((criterio, indice) => (
              <li key={indice}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={estado.aceite[indice] ?? false}
                    onChange={(evento) => {
                      const proximo = [...estado.aceite]
                      proximo[indice] = evento.target.checked
                      setEstado((atual) => ({ ...atual, aceite: proximo }))
                    }}
                    className="accent-accent mt-0.5 h-4 w-4"
                  />
                  <span className="text-ink text-sm leading-relaxed">{criterio}</span>
                </label>
              </li>
            ))}
          </ul>

          <p className="text-ink-faint text-xs tabular-nums">
            {estado.aceite.filter(Boolean).length} de {criterios.length} marcados
          </p>
        </Cartao>
      ) : null}

      {checklistRevisao.length > 0 ? (
        <details className="border-line bg-surface-raised rounded-lg border">
          <summary className="text-ink min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
            Autorrevisão antes de abrir o PR
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <ul className="text-ink-muted list-disc space-y-1 pl-5 text-sm">
              {checklistRevisao.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <Campo
              id="auto-revisao"
              rotulo="O que a revisão encontrou"
              ajuda="Se não encontrou nada, escreva o que você verificou."
              valor={estado.autoRevisao}
              aoMudar={(valor) => setEstado((atual) => ({ ...atual, autoRevisao: valor }))}
              linhas={3}
              classe={classeEntrada}
            />
          </div>
        </details>
      ) : null}

      <Cartao className="space-y-4">
        <div className="space-y-1">
          <p className="text-ink text-sm font-medium">Entrega</p>
          <p className="text-ink-muted text-sm">
            Como isso chegaria ao time: a branch, o título e a descrição do pull request.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="branch" className="text-ink block text-sm font-medium">
              Nome da branch
            </label>
            <input
              id="branch"
              value={estado.branch}
              onChange={(evento) => setEstado((atual) => ({ ...atual, branch: evento.target.value }))}
              className={juntar(classeEntrada, 'font-mono text-sm')}
              placeholder="feat/filtro-pedidos"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="repositorio" className="text-ink block text-sm font-medium">
              Link do repositório (opcional)
            </label>
            <input
              id="repositorio"
              type="url"
              value={estado.repositorio}
              onChange={(evento) => setEstado((atual) => ({ ...atual, repositorio: evento.target.value }))}
              className={classeEntrada}
              placeholder="https://github.com/…"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="titulo-pr" className="text-ink block text-sm font-medium">
            Título do pull request
          </label>
          <input
            id="titulo-pr"
            value={estado.tituloPr}
            onChange={(evento) => setEstado((atual) => ({ ...atual, tituloPr: evento.target.value }))}
            className={classeEntrada}
            placeholder="filtra pedidos por status e período no banco"
          />
        </div>

        <Campo
          id="corpo-pr"
          rotulo="Descrição do pull request"
          ajuda="O que muda, por quê, como testou e o que ficou de fora."
          valor={estado.corpoPr}
          aoMudar={(valor) => setEstado((atual) => ({ ...atual, corpoPr: valor }))}
          linhas={7}
          classe={classeEntrada}
        />
      </Cartao>

      {mensagem ? <p className="text-ok-ink text-sm">{mensagem}</p> : null}
      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      <div className="border-line bg-surface-raised flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <Botao type="button" variante="secundario" onClick={() => chamar('salvar')} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Botao>

        {!concluida ? (
          <Botao type="button" variante="primario" onClick={() => chamar('concluir')} disabled={salvando}>
            Marcar como concluída
          </Botao>
        ) : null}

        {!concluida ? (
          <Botao type="button" variante="discreto" onClick={() => chamar('abandonar')} disabled={salvando}>
            Parar por agora
          </Botao>
        ) : null}
      </div>

      {!aceiteCompleto && !concluida ? (
        <Nota>
          Você pode concluir sem marcar todos os critérios. O registro do que ficou pendente é mais útil que
          uma marcação falsa.
        </Nota>
      ) : null}
    </div>
  )
}

function Campo({
  id,
  rotulo,
  ajuda,
  valor,
  aoMudar,
  linhas,
  classe,
}: {
  id: string
  rotulo: string
  ajuda?: string
  valor: string
  aoMudar: (valor: string) => void
  linhas: number
  classe: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {rotulo}
      </label>
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-ink-muted text-xs">
          {ajuda}
        </p>
      ) : null}
      <textarea
        id={id}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        rows={linhas}
        aria-describedby={ajuda ? `${id}-ajuda` : undefined}
        spellCheck={!classe.includes('font-mono')}
        className={classe}
      />
    </div>
  )
}
