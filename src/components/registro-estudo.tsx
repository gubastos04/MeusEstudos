'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { enviar, enviarEmSegundoPlano } from '@/lib/cliente-api'
import { enfileirar, registrarProgresso } from '@/lib/offline'
import { Botao, BotaoLink, Nota, juntar } from './ui'

/**
 * Registro de estudo de um conteudo.
 *
 * O que este componente garante:
 * - abrir o conteudo marca como iniciado (retomavel depois);
 * - sair a qualquer momento salva tempo e ponto de parada, inclusive fechando a
 *   aba (sendBeacon);
 * - concluir e uma acao explicita da pessoa, nunca automatica por rolagem;
 * - nada aqui pune interrupcao: sair no meio e um estado normal.
 *
 * O tempo contado para quando a aba fica oculta, para uma aba esquecida aberta
 * nao virar "tempo estudado".
 */

type Props = {
  tipo: 'lesson' | 'checkpoint'
  id: string
  moduloId: string
  concluido: boolean
  proximoHref?: string | null
  proximoTitulo?: string | null
  moduloHref: string
}

export function RegistroEstudo({
  tipo,
  id,
  moduloId,
  concluido,
  proximoHref,
  proximoTitulo,
  moduloHref,
}: Props) {
  const router = useRouter()
  const [marcado, setMarcado] = useState(concluido)
  const [naFila, setNaFila] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const inicio = useRef<number>(Date.now())
  const acumulado = useRef<number>(0)
  const visivel = useRef<boolean>(true)

  useEffect(() => {
    void enviar('/api/progresso', { acao: 'iniciar', tipo, id, moduloId })

    function pausar() {
      if (!visivel.current) return
      visivel.current = false
      acumulado.current += Math.round((Date.now() - inicio.current) / 1000)
    }

    function retomar() {
      if (visivel.current) return
      visivel.current = true
      inicio.current = Date.now()
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === 'hidden') pausar()
      else retomar()
    }

    function aoSair() {
      pausar()
      const segundos = acumulado.current
      if (segundos < 5) return

      const evento = {
        acao: 'salvar' as const,
        tipo,
        id,
        moduloId,
        segundos,
        bloco: blocoVisivel(),
        ocorridoEm: new Date().toISOString(),
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Sem rede, sendBeacon apenas descartaria o registro em silencio.
        enfileirar(evento)
      } else {
        enviarEmSegundoPlano('/api/progresso', evento)
      }

      acumulado.current = 0
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('pagehide', aoSair)

    return () => {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('pagehide', aoSair)
      aoSair()
    }
  }, [tipo, id, moduloId])

  function segundosAtuais(): number {
    const parcial = visivel.current ? Math.round((Date.now() - inicio.current) / 1000) : 0
    return acumulado.current + parcial
  }

  async function concluir() {
    if (salvando || marcado) return
    setSalvando(true)

    // Offline, o registro entra na fila em vez de se perder.
    const destino = await registrarProgresso({
      acao: 'concluir',
      tipo,
      id,
      moduloId,
      segundos: segundosAtuais(),
      ocorridoEm: new Date().toISOString(),
    })

    acumulado.current = 0
    inicio.current = Date.now()
    setSalvando(false)
    setMarcado(true)
    setNaFila(destino === 'na-fila')

    if (destino === 'enviado') router.refresh()
  }

  return (
    <div className="border-line bg-surface-raised space-y-3 rounded-lg border p-4">
      {marcado && naFila ? (
        <p className="text-ink text-sm">
          Marcado. Como você está sem conexão, sobe para o servidor assim que a rede voltar.
        </p>
      ) : marcado ? (
        <p className="text-ok-ink text-sm">Marcado como concluído. Isso não volta pra trás.</p>
      ) : (
        <p className="text-ink-muted text-sm">
          Parou no meio? Volte depois. Nada aqui te pune por isso.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          type="button"
          variante={marcado ? 'secundario' : 'primario'}
          onClick={concluir}
          disabled={salvando || marcado}
        >
          {marcado ? 'Concluído' : salvando ? 'Salvando…' : 'Marcar como concluído'}
        </Botao>

        {proximoHref ? (
          <BotaoLink href={proximoHref} variante={marcado ? 'primario' : 'secundario'}>
            Próximo: {proximoTitulo}
          </BotaoLink>
        ) : (
          <BotaoLink href={moduloHref} variante="secundario">
            Voltar ao módulo
          </BotaoLink>
        )}
      </div>

      {!marcado ? (
        <Nota>
          <span className={juntar('text-xs')}>
            Seu bloco acabou? Marcar como feita agora já é lucro. Você pode voltar e revisar quando quiser.
          </span>
        </Nota>
      ) : null}
    </div>
  )
}

/**
 * Indice aproximado do bloco visivel, para retomar perto de onde parou.
 * Usa a posicao de rolagem sobre os blocos marcados com data-bloco.
 */
function blocoVisivel(): number {
  try {
    const blocos = document.querySelectorAll<HTMLElement>('[data-bloco]')
    let atual = 0
    for (const bloco of blocos) {
      if (bloco.getBoundingClientRect().top < window.innerHeight * 0.4) {
        atual = Number(bloco.dataset.bloco ?? 0)
      }
    }
    return atual
  } catch {
    return 0
  }
}
