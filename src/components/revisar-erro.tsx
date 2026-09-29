'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { atualizar } from '@/lib/cliente-api'
import { Botao, Cartao, juntar } from './ui'
import { EditorErro, type ErroRegistrado } from './editor-erro'

/**
 * Revisao de um erro registrado (spec 65).
 *
 * A revisao aqui nao e repeticao artificial: o material e o proprio erro que a
 * pessoa viveu. Antes de mostrar a resposta, pergunta se ela ainda lembra — e
 * so entao revela causa, solucao e aprendizado.
 */

export function RevisarErro({ registro }: { registro: ErroRegistrado & { revisadoEm: string | null } }) {
  const router = useRouter()
  const [revelado, setRevelado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function marcarRevisado() {
    if (salvando) return
    setSalvando(true)
    await atualizar(`/api/erros/${registro.id}`, { revisado: true })
    setSalvando(false)
    router.refresh()
  }

  if (editando) {
    return <EditorErro registro={registro} aoCancelar={() => setEditando(false)} />
  }

  return (
    <div className="space-y-4">
      <Cartao className="space-y-3">
        <div className="space-y-1">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Revisão</p>
          <p className="text-ink text-sm">
            Antes de ler a resposta: você ainda lembra a causa e como resolveu?
          </p>
        </div>

        {!revelado ? (
          <Botao type="button" variante="secundario" onClick={() => setRevelado(true)}>
            Mostrar o que eu registrei
          </Botao>
        ) : (
          <div className="space-y-3">
            {registro.contexto ? (
              <Bloco rotulo="Contexto" texto={registro.contexto} />
            ) : null}
            <Bloco rotulo="Causa" texto={registro.causa || 'Não foi registrada.'} />
            <Bloco rotulo="Solução" texto={registro.solucao || 'Não foi registrada.'} />
            <Bloco rotulo="Aprendizado" texto={registro.aprendizado || 'Não foi registrado.'} destaque />

            {registro.codigo ? (
              <div className="space-y-1">
                <p className="text-ink-faint text-xs uppercase tracking-wide">Código</p>
                <pre className="border-line bg-surface-code text-ink overflow-x-auto rounded border p-3 text-xs leading-relaxed">
                  <code>{registro.codigo}</code>
                </pre>
              </div>
            ) : null}
          </div>
        )}
      </Cartao>

      <div className="flex flex-wrap items-center gap-2">
        <Botao type="button" variante="primario" onClick={marcarRevisado} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Marcar como revisado'}
        </Botao>

        <Botao type="button" variante="secundario" onClick={() => setEditando(true)}>
          Editar registro
        </Botao>
      </div>
    </div>
  )
}

function Bloco({ rotulo, texto, destaque }: { rotulo: string; texto: string; destaque?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-ink-faint text-xs uppercase tracking-wide">{rotulo}</p>
      <p
        className={juntar(
          'text-sm leading-relaxed whitespace-pre-line',
          destaque ? 'text-ink font-medium' : 'text-ink',
        )}
      >
        {texto}
      </p>
    </div>
  )
}
