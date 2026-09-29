'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { baixarModulo, cacheDisponivel, moduloBaixado, removerModulo } from '@/lib/offline'
import { Botao, juntar } from './ui'

/**
 * Baixar um modulo para ler sem conexao.
 *
 * O que fica no aparelho e o conteudo do curriculo. Progresso, anotacoes e
 * erros continuam so no servidor: eles sao dado da pessoa e nao vao para um
 * cache que sobrevive ao logout.
 */
export function BaixarModulo({ moduloId, titulo }: { moduloId: string; titulo: string }) {
  const [suportado, setSuportado] = useState(true)
  const [baixado, setBaixado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!cacheDisponivel()) {
      setSuportado(false)
      return
    }
    void moduloBaixado(moduloId).then(setBaixado)
  }, [moduloId])

  if (!suportado) return null

  async function baixar() {
    setOcupado(true)
    setErro(null)

    const resultado = await baixarModulo(moduloId)

    setOcupado(false)

    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }

    setBaixado(true)
  }

  async function remover() {
    setOcupado(true)
    await removerModulo(moduloId)
    setBaixado(false)
    setOcupado(false)
  }

  return (
    <div className="border-line bg-surface-raised space-y-2 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-ink text-sm font-medium">
          {baixado ? 'Disponível offline' : 'Ler sem conexão'}
        </p>
        <p className="text-ink-muted text-sm">
          {baixado
            ? `${titulo} fica legível mesmo sem internet. O que você marcar offline sobe quando a rede voltar.`
            : 'Baixa o conteúdo deste módulo para o aparelho. Útil para estudar no transporte ou sem sinal.'}
        </p>
      </div>

      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      <div className={juntar('flex flex-wrap items-center gap-2')}>
        {baixado ? (
          <>
            <Link
              href={`/leitura-offline?modulo=${moduloId}`}
              className="border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken inline-flex min-h-9 items-center rounded border px-3 text-sm font-medium"
            >
              Abrir leitura offline
            </Link>
            <Botao type="button" variante="discreto" onClick={remover} disabled={ocupado}>
              Remover do aparelho
            </Botao>
          </>
        ) : (
          <Botao type="button" variante="secundario" onClick={baixar} disabled={ocupado}>
            {ocupado ? 'Baixando…' : 'Baixar para ler offline'}
          </Botao>
        )}
      </div>
    </div>
  )
}
