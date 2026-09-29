'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { ContentBlock } from '@/lib/content/schema'
import {
  enfileirar,
  lerModuloOffline,
  listarModulosBaixados,
  pendentes,
  type ItemOffline,
  type ModuloOffline,
} from '@/lib/offline'
import { Blocos } from './blocos'
import { GlossarioInline, type TermoResumido } from './glossario-inline'
import { renderizarInline } from './texto-inline'
import { Botao, Cartao, Carregando, Nota, Selo, Vazio, juntar } from './ui'

/**
 * Leitura offline.
 *
 * Renderiza o conteudo baixado com os MESMOS componentes da tela online, para
 * o texto nao ficar diferente do que a pessoa ja conhece.
 *
 * O que existe aqui: leitura, "tente agora", se travar, erro comum, glossario e
 * marcar como concluido (que entra na fila e sobe depois).
 *
 * O que nao existe, e a tela diz isso: editor de codigo com testes, IA,
 * anotacoes e registro de erro. Todos dependem de servidor ou de download, e
 * prometer o que nao funciona seria pior que avisar.
 */

type Props = {
  moduloInicial?: string
  itemInicial?: string
}

export function LeitorOffline({ moduloInicial, itemInicial }: Props) {
  const [carregando, setCarregando] = useState(true)
  const [modulos, setModulos] = useState<ModuloOffline[]>([])
  const [moduloAberto, setModuloAberto] = useState<ModuloOffline | null>(null)
  const [itemAberto, setItemAberto] = useState<ItemOffline | null>(null)
  const [naFila, setNaFila] = useState(0)
  const [marcado, setMarcado] = useState<string | null>(null)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)

    async function carregar() {
      const baixados = await listarModulosBaixados()
      setModulos(baixados)

      if (moduloInicial) {
        const escolhido = await lerModuloOffline(moduloInicial)
        if (escolhido) {
          setModuloAberto(escolhido)
          if (itemInicial) {
            const item = escolhido.modulo.items.find((candidato) => candidato.id === itemInicial)
            if (item) setItemAberto(item)
          }
        }
      }

      setNaFila(pendentes())
      setCarregando(false)
    }

    void carregar()
  }, [moduloInicial, itemInicial])

  function marcarConcluido(item: ItemOffline, moduloId: string) {
    enfileirar({
      acao: 'concluir',
      tipo: item.type,
      id: item.id,
      moduloId,
      segundos: 0,
      ocorridoEm: new Date().toISOString(),
    })

    setMarcado(item.id)
    setNaFila(pendentes())
  }

  if (carregando) {
    return <Carregando linhas={4} />
  }

  // --- Um item aberto --------------------------------------------------------
  if (moduloAberto && itemAberto) {
    const termos: TermoResumido[] = Array.isArray(itemAberto.glossary)
      ? (itemAberto.glossary as string[])
          .map((referencia) =>
            moduloAberto.glossario.find(
              (termo) =>
                termo.id.toLowerCase() === referencia.toLowerCase() ||
                termo.term.toLowerCase() === referencia.toLowerCase(),
            ),
          )
          .filter((termo): termo is NonNullable<typeof termo> => Boolean(termo))
          .map((termo) => ({
            id: termo.id,
            term: termo.term,
            short: termo.short,
            explanation: termo.explanation,
            example: termo.example ?? null,
            whereItAppears: termo.whereItAppears,
          }))
      : []

    const tryNow = itemAberto.tryNow as { instructions: string; expected?: string } | undefined
    const ifStuck = (itemAberto.ifStuck as string[] | undefined) ?? []
    const commonErrors =
      (itemAberto.commonErrors as { error: string; why: string; fix: string }[] | undefined) ?? []
    const exercicio = itemAberto.exercise as { title: string; prompt: string } | undefined

    return (
      <article className="space-y-6">
        <button
          type="button"
          onClick={() => setItemAberto(null)}
          className="text-ink-muted hover:text-ink text-sm"
        >
          ← {moduloAberto.modulo.title}
        </button>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Selo>{itemAberto.estimatedMinutes} min</Selo>
            <Selo tom="accent">lendo offline</Selo>
          </div>
          <h1 className="text-2xl">{itemAberto.title}</h1>
        </div>

        {itemAberto.type === 'lesson' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Cartao className="space-y-1">
                <p className="text-ink-faint text-xs uppercase tracking-wide">Por que isso existe</p>
                <p className="text-ink text-sm leading-relaxed">
                  {renderizarInline(String(itemAberto.why ?? ''))}
                </p>
              </Cartao>
              <Cartao className="space-y-1">
                <p className="text-ink-faint text-xs uppercase tracking-wide">O que você vai fazer</p>
                <p className="text-ink text-sm leading-relaxed">
                  {renderizarInline(String(itemAberto.goal ?? ''))}
                </p>
              </Cartao>
            </div>

            <div className="leitura">
              <Blocos blocos={(itemAberto.blocks as ContentBlock[]) ?? []} />
            </div>

            {tryNow ? (
              <section className="border-accent/30 bg-accent-soft space-y-2 rounded-lg border p-4">
                <p className="text-accent-ink text-xs font-medium uppercase tracking-wide">Tente agora</p>
                <p className="text-ink text-sm leading-relaxed whitespace-pre-line">
                  {renderizarInline(tryNow.instructions)}
                </p>
                {tryNow.expected ? (
                  <p className="text-ink-muted text-sm">
                    <span className="text-ink-faint">Resultado esperado: </span>
                    {renderizarInline(tryNow.expected)}
                  </p>
                ) : null}
              </section>
            ) : null}

            {ifStuck.length > 0 ? (
              <details className="border-line bg-surface-raised rounded-lg border">
                <summary className="text-ink min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
                  Se travar
                </summary>
                <ul className="text-ink-muted list-disc space-y-1.5 px-4 pb-4 pl-9 text-sm">
                  {ifStuck.map((dica, indice) => (
                    <li key={indice} className="leading-relaxed">
                      {renderizarInline(dica)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {commonErrors.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-lg">Erro comum</h2>
                {commonErrors.map((erro, indice) => (
                  <Cartao key={indice} className="space-y-2">
                    <p className="text-danger-ink font-mono text-sm break-words">{erro.error}</p>
                    <p className="text-ink-muted text-sm">
                      <span className="text-ink-faint">Por que: </span>
                      {renderizarInline(erro.why)}
                    </p>
                    <p className="text-ink text-sm">
                      <span className="text-ink-faint">Como resolver: </span>
                      {renderizarInline(erro.fix)}
                    </p>
                  </Cartao>
                ))}
              </section>
            ) : null}

            {exercicio ? (
              <Nota titulo={`Exercício: ${exercicio.title}`}>
                <p className="leading-relaxed whitespace-pre-line">{renderizarInline(exercicio.prompt)}</p>
                <p className="text-ink-faint mt-2">
                  O editor e os testes precisam de conexão. Dá para pensar na solução agora e escrever
                  quando a rede voltar.
                </p>
              </Nota>
            ) : null}

            <GlossarioInline termos={termos} />
          </>
        ) : (
          <div className="leitura space-y-4">
            <p className="text-ink leading-relaxed">{renderizarInline(String(itemAberto.summary ?? ''))}</p>
            <ul className="text-ink marker:text-ink-faint list-disc space-y-1.5 pl-5">
              {((itemAberto.learned as string[] | undefined) ?? []).map((aprendido, indice) => (
                <li key={indice} className="leading-relaxed">
                  {renderizarInline(aprendido)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-line bg-surface-raised space-y-3 rounded-lg border p-4">
          {marcado === itemAberto.id ? (
            <p className="text-ok-ink text-sm">
              Guardado. Sobe para o servidor assim que a conexão voltar.
            </p>
          ) : (
            <p className="text-ink-muted text-sm">
              Parou no meio? Volte depois. Nada aqui te pune por isso.
            </p>
          )}

          <Botao
            type="button"
            variante={marcado === itemAberto.id ? 'secundario' : 'primario'}
            onClick={() => marcarConcluido(itemAberto, moduloAberto.modulo.id)}
            disabled={marcado === itemAberto.id}
          >
            {marcado === itemAberto.id ? 'Marcado' : 'Marcar como concluído'}
          </Botao>
        </div>
      </article>
    )
  }

  // --- Um módulo aberto ------------------------------------------------------
  if (moduloAberto) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setModuloAberto(null)}
          className="text-ink-muted hover:text-ink text-sm"
        >
          ← Módulos baixados
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl">{moduloAberto.modulo.title}</h1>
          <p className="text-ink-muted text-sm">{moduloAberto.modulo.summary}</p>
        </div>

        <ol className="space-y-2">
          {moduloAberto.modulo.items.map((item, indice) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setItemAberto(item)}
                className="border-line bg-surface-raised hover:border-line-strong flex w-full items-start gap-3 rounded-lg border p-3 text-left transition"
              >
                <span className="border-line text-ink-faint mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums">
                  {indice + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink block text-sm font-medium">{item.title}</span>
                  <span className="text-ink-muted block text-xs">{item.estimatedMinutes} min</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // --- Lista de módulos baixados ---------------------------------------------
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl">Leitura offline</h1>
        <p className="text-ink-muted text-sm">
          {online
            ? 'Conteúdo que você baixou para este aparelho.'
            : 'Você está sem conexão. Isto é o que está disponível neste aparelho.'}
        </p>
      </div>

      {naFila > 0 ? (
        <Nota>
          {naFila} {naFila === 1 ? 'registro aguardando' : 'registros aguardando'} o retorno da conexão.
          Nada se perde até subir.
        </Nota>
      ) : null}

      {modulos.length === 0 ? (
        <Vazio
          titulo="Nenhum módulo baixado"
          descricao="Abra um módulo com conexão e use 'Baixar para ler offline'. Depois ele fica legível aqui mesmo sem rede."
          acao={
            online ? (
              <Link
                href="/estudar"
                className="bg-accent text-ink-inverse hover:bg-accent-hover inline-flex min-h-11 items-center rounded border border-transparent px-4 text-sm font-medium"
              >
                Ver módulos
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {modulos.map((item) => (
            <li key={item.modulo.id}>
              <button
                type="button"
                onClick={() => setModuloAberto(item)}
                className={juntar(
                  'border-line bg-surface-raised hover:border-line-strong block w-full rounded-lg border p-4 text-left transition',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Selo>{item.modulo.semester}º semestre</Selo>
                  <Selo>{item.modulo.items.length} itens</Selo>
                </div>
                <p className="text-ink mt-2 text-base font-semibold">{item.modulo.title}</p>
                <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{item.modulo.summary}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {online ? (
        <Link href="/inicio" className="text-accent-ink block text-sm font-medium underline underline-offset-2">
          Voltar para a plataforma
        </Link>
      ) : null}
    </div>
  )
}
