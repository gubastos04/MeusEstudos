'use client'

import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { Botao, juntar } from './ui'

/**
 * Atalhos para registrar anotacao ou erro sem sair da tela de estudo.
 *
 * O momento de registrar um erro e quando ele acabou de acontecer. Obrigar a
 * pessoa a navegar para outra secao significa que ela nao vai registrar.
 */

type Contexto = {
  moduloId?: string
  nodeType?: string
  nodeId?: string
  titulo?: string
}

type Aberto = 'anotacao' | 'erro' | null

export function AtalhosDeRegistro({ contexto }: { contexto: Contexto }) {
  const [aberto, setAberto] = useState<Aberto>(null)
  const [salvo, setSalvo] = useState<Aberto>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [tituloNota, setTituloNota] = useState('')
  const [corpoNota, setCorpoNota] = useState('')

  const [tituloErro, setTituloErro] = useState('')
  const [causa, setCausa] = useState('')
  const [solucao, setSolucao] = useState('')
  const [aprendizado, setAprendizado] = useState('')

  async function salvarAnotacao() {
    if (enviando || tituloNota.trim().length < 3) return
    setEnviando(true)
    setErro(null)

    const resposta = await enviar('/api/anotacoes', {
      titulo: tituloNota,
      corpo: corpoNota,
      moduloId: contexto.moduloId,
      nodeType: contexto.nodeType,
      nodeId: contexto.nodeId,
    })

    setEnviando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setTituloNota('')
    setCorpoNota('')
    setAberto(null)
    setSalvo('anotacao')
  }

  async function salvarErro() {
    if (enviando || tituloErro.trim().length < 3) return
    setEnviando(true)
    setErro(null)

    const resposta = await enviar('/api/erros', {
      titulo: tituloErro,
      contexto: contexto.titulo ? `Durante: ${contexto.titulo}` : '',
      causa,
      solucao,
      aprendizado,
      moduloId: contexto.moduloId,
      nodeType: contexto.nodeType,
      nodeId: contexto.nodeId,
    })

    setEnviando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setTituloErro('')
    setCausa('')
    setSolucao('')
    setAprendizado('')
    setAberto(null)
    setSalvo('erro')
  }

  const classeEntrada =
    'border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base'

  return (
    <section className="border-line bg-surface-raised space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { chave: 'anotacao' as const, rotulo: 'Salvar anotação' },
            { chave: 'erro' as const, rotulo: 'Registrar um erro' },
          ] satisfies { chave: Exclude<Aberto, null>; rotulo: string }[]
        ).map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => {
              setSalvo(null)
              setAberto(aberto === item.chave ? null : item.chave)
            }}
            aria-expanded={aberto === item.chave}
            className={juntar(
              'min-h-9 rounded border px-2.5 text-sm transition',
              aberto === item.chave
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-surface text-ink-muted hover:text-ink',
            )}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {salvo === 'anotacao' ? (
        <p className="text-ok-ink text-sm">
          Anotação salva. Ela fica em Anotações, sincronizada entre seus dispositivos.
        </p>
      ) : null}
      {salvo === 'erro' ? (
        <p className="text-ok-ink text-sm">Erro registrado. Ele vai aparecer nas suas revisões.</p>
      ) : null}

      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      {aberto === 'anotacao' ? (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <label htmlFor="nota-titulo" className="text-ink block text-sm font-medium">
              Título
            </label>
            <input
              id="nota-titulo"
              value={tituloNota}
              onChange={(evento) => setTituloNota(evento.target.value)}
              className={classeEntrada}
              placeholder="Índice composto: igualdade primeiro"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nota-corpo" className="text-ink block text-sm font-medium">
              Anotação
            </label>
            <textarea
              id="nota-corpo"
              value={corpoNota}
              onChange={(evento) => setCorpoNota(evento.target.value)}
              rows={4}
              className={juntar(classeEntrada, 'leading-relaxed')}
              placeholder="Escreva com suas palavras. Quem escreve lembra."
            />
          </div>

          <Botao
            type="button"
            variante="primario"
            onClick={salvarAnotacao}
            disabled={enviando || tituloNota.trim().length < 3}
          >
            {enviando ? 'Salvando…' : 'Salvar anotação'}
          </Botao>
        </div>
      ) : null}

      {aberto === 'erro' ? (
        <div className="space-y-2">
          <p className="text-ink-muted text-sm">
            Seja honesto aqui. O registro só serve se for verdade.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="erro-titulo" className="text-ink block text-sm font-medium">
              O erro
            </label>
            <input
              id="erro-titulo"
              value={tituloErro}
              onChange={(evento) => setTituloErro(evento.target.value)}
              className={classeEntrada}
              placeholder="CORS bloqueando requisição"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="erro-causa" className="text-ink block text-sm font-medium">
                Causa
              </label>
              <textarea
                id="erro-causa"
                value={causa}
                onChange={(evento) => setCausa(evento.target.value)}
                rows={3}
                className={juntar(classeEntrada, 'leading-relaxed')}
                placeholder="A API não permitia a origem do frontend."
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="erro-solucao" className="text-ink block text-sm font-medium">
                Solução
              </label>
              <textarea
                id="erro-solucao"
                value={solucao}
                onChange={(evento) => setSolucao(evento.target.value)}
                rows={3}
                className={juntar(classeEntrada, 'leading-relaxed')}
                placeholder="Configurar CORS no backend."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="erro-aprendizado" className="text-ink block text-sm font-medium">
              Aprendizado
            </label>
            <textarea
              id="erro-aprendizado"
              value={aprendizado}
              onChange={(evento) => setAprendizado(evento.target.value)}
              rows={2}
              className={juntar(classeEntrada, 'leading-relaxed')}
              placeholder="O navegador aplica política de mesma origem."
            />
          </div>

          <Botao
            type="button"
            variante="primario"
            onClick={salvarErro}
            disabled={enviando || tituloErro.trim().length < 3}
          >
            {enviando ? 'Salvando…' : 'Registrar erro'}
          </Botao>
        </div>
      ) : null}
    </section>
  )
}
