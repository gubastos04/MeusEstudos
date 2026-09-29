'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { atualizar, enviar, remover } from '@/lib/cliente-api'
import { Botao, Cartao } from './ui'

/**
 * Anotacao privada.
 *
 * As anotacoes ficam no banco, e nao no navegador: quem estuda no celular hoje
 * e no computador amanha precisa encontrar o que escreveu.
 */

export type AnotacaoRegistrada = {
  id: string
  titulo: string
  corpo: string
  codigo: string
  linguagem: string
  tags: string[]
  fixada: boolean
}

const vazia: Omit<AnotacaoRegistrada, 'id'> = {
  titulo: '',
  corpo: '',
  codigo: '',
  linguagem: 'text',
  tags: [],
  fixada: false,
}

export function EditorAnotacao({
  anotacao,
  aoCancelar,
}: {
  anotacao?: AnotacaoRegistrada
  aoCancelar?: () => void
}) {
  const router = useRouter()
  const editando = Boolean(anotacao)
  const [dados, setDados] = useState<Omit<AnotacaoRegistrada, 'id'>>(anotacao ?? vazia)
  const [tagsTexto, setTagsTexto] = useState((anotacao?.tags ?? []).join(', '))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  async function salvar() {
    if (salvando || dados.titulo.trim().length < 3) return
    setSalvando(true)
    setErro(null)

    const tags = tagsTexto
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 10)

    const corpo = {
      titulo: dados.titulo,
      corpo: dados.corpo,
      codigo: dados.codigo,
      linguagem: dados.linguagem,
      tags,
      fixada: dados.fixada,
    }

    const resposta = anotacao
      ? await atualizar(`/api/anotacoes/${anotacao.id}`, corpo)
      : await enviar<{ id: string }>('/api/anotacoes', corpo)

    setSalvando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    if (!anotacao) {
      setDados(vazia)
      setTagsTexto('')
    }

    router.refresh()
    aoCancelar?.()
  }

  async function excluir() {
    if (!anotacao || salvando) return
    setSalvando(true)

    const resposta = await remover(`/api/anotacoes/${anotacao.id}`)
    setSalvando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    router.push('/anotacoes')
    router.refresh()
  }

  const classe =
    'border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base leading-relaxed'

  return (
    <Cartao className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="nota-titulo" className="text-ink block text-sm font-medium">
          Título
        </label>
        <input
          id="nota-titulo"
          value={dados.titulo}
          onChange={(evento) => setDados((atual) => ({ ...atual, titulo: evento.target.value }))}
          className={classe}
          placeholder="Quando usar transação"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nota-corpo" className="text-ink block text-sm font-medium">
          Anotação
        </label>
        <textarea
          id="nota-corpo"
          value={dados.corpo}
          onChange={(evento) => setDados((atual) => ({ ...atual, corpo: evento.target.value }))}
          rows={8}
          className={classe}
          placeholder="Escreva com suas palavras. Copiar não fixa; escrever, sim."
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nota-codigo" className="text-ink block text-sm font-medium">
          Código
        </label>
        <textarea
          id="nota-codigo"
          value={dados.codigo}
          onChange={(evento) => setDados((atual) => ({ ...atual, codigo: evento.target.value }))}
          rows={6}
          spellCheck={false}
          className={`${classe} font-mono text-[13px]`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="nota-tags" className="text-ink block text-sm font-medium">
            Tags
          </label>
          <p className="text-ink-muted text-xs">Separadas por vírgula.</p>
          <input
            id="nota-tags"
            value={tagsTexto}
            onChange={(evento) => setTagsTexto(evento.target.value)}
            className={classe}
            placeholder="sql, transação, banco"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nota-linguagem" className="text-ink block text-sm font-medium">
            Linguagem do código
          </label>
          <select
            id="nota-linguagem"
            value={dados.linguagem}
            onChange={(evento) => setDados((atual) => ({ ...atual, linguagem: evento.target.value }))}
            className={classe}
          >
            {['text', 'python', 'javascript', 'typescript', 'sql', 'html', 'css', 'bash', 'java', 'php'].map(
              (linguagem) => (
                <option key={linguagem} value={linguagem}>
                  {linguagem}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <label className="text-ink flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dados.fixada}
          onChange={(evento) => setDados((atual) => ({ ...atual, fixada: evento.target.checked }))}
          className="accent-accent h-4 w-4"
        />
        Fixar no topo da lista
      </label>

      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          type="button"
          variante="primario"
          onClick={salvar}
          disabled={salvando || dados.titulo.trim().length < 3}
        >
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar anotação'}
        </Botao>

        {aoCancelar ? (
          <Botao type="button" variante="discreto" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Botao>
        ) : null}

        {anotacao ? (
          confirmando ? (
            <>
              <Botao type="button" variante="perigo" onClick={excluir} disabled={salvando}>
                Confirmar exclusão
              </Botao>
              <Botao type="button" variante="discreto" onClick={() => setConfirmando(false)}>
                Manter
              </Botao>
            </>
          ) : (
            <Botao type="button" variante="perigo" onClick={() => setConfirmando(true)}>
              Excluir
            </Botao>
          )
        ) : null}
      </div>
    </Cartao>
  )
}

export function NovaAnotacao() {
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <Botao type="button" variante="primario" onClick={() => setAberto(true)}>
        Nova anotação
      </Botao>
    )
  }

  return <EditorAnotacao aoCancelar={() => setAberto(false)} />
}
