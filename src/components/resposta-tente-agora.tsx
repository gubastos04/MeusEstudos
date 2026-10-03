'use client'

import { useState } from 'react'

import { atualizar, enviar } from '@/lib/cliente-api'
import { CampoTexto } from './campos'
import { Botao } from './ui'

/**
 * Onde escrever a resposta do "Tente agora".
 *
 * Por que existe: o bloco dizia o que fazer e não tinha onde fazer, então a
 * pessoa precisava abrir um editor de texto ou pegar papel — exatamente o
 * "trocar de janela" que o produto evita. Ler a instrução e fechar a aula sem
 * escrever nada é o caminho mais fácil, e é o que não ensina.
 *
 * Guarda como anotação vinculada à aula, usando o que já existe: `Note` tem
 * `moduleId`, `nodeType` e `nodeId` desde sempre. Nada de tabela nova — e o que
 * a pessoa escreve aqui aparece em Anotações, pesquisável junto do resto.
 */
export function RespostaTenteAgora({
  moduloId,
  itemId,
  tituloDoItem,
  inicial,
}: {
  moduloId: string
  itemId: string
  tituloDoItem: string
  inicial: { id: string; corpo: string } | null
}) {
  const [texto, setTexto] = useState(inicial?.corpo ?? '')
  const [idDaAnotacao, setIdDaAnotacao] = useState(inicial?.id ?? null)
  const [salvoComo, setSalvoComo] = useState(inicial?.corpo ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mudou = texto.trim() !== salvoComo.trim()
  const temTexto = texto.trim().length > 0

  async function salvar() {
    if (ocupado || !mudou || !temTexto) return

    setOcupado(true)
    setErro(null)

    // Título curto o bastante para caber no limite e ainda dizer de onde veio.
    const titulo = `Tente agora — ${tituloDoItem}`.slice(0, 140)

    if (idDaAnotacao) {
      const resposta = await atualizar(`/api/anotacoes/${idDaAnotacao}`, { corpo: texto })
      setOcupado(false)

      if (!resposta.ok) {
        setErro(resposta.erro)
        return
      }
    } else {
      const resposta = await enviar<{ id: string }>('/api/anotacoes', {
        titulo,
        corpo: texto,
        moduloId,
        nodeType: 'tente-agora',
        nodeId: itemId,
      })
      setOcupado(false)

      if (!resposta.ok) {
        setErro(resposta.erro)
        return
      }

      setIdDaAnotacao(resposta.dados.id)
    }

    setSalvoComo(texto)
  }

  return (
    <div className="space-y-2">
      <CampoTexto
        rotulo="Sua resposta"
        ajuda="Fica salvo em Anotações, ligado a esta aula. Dá para voltar e continuar depois."
        erro={erro}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        rows={5}
        placeholder="Escreva aqui…"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="button" onClick={salvar} disabled={ocupado || !mudou || !temTexto}>
          {ocupado ? 'Salvando…' : idDaAnotacao ? 'Salvar alterações' : 'Salvar resposta'}
        </Botao>

        {/* Sem elogio: informa o estado e para por aí. */}
        {!mudou && salvoComo.trim().length > 0 ? (
          <span className="text-ink-muted text-sm">Salvo em Anotações.</span>
        ) : null}
      </div>
    </div>
  )
}
