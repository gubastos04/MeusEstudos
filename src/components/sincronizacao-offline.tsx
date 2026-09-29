'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { pendentes, sincronizar } from '@/lib/offline'
import { juntar } from './ui'

/**
 * Registro do service worker, aviso de offline e envio da fila.
 *
 * Fica montado em toda tela autenticada. Comportamento:
 * - registra o service worker (so em producao: em desenvolvimento ele brigaria
 *   com a recarga automatica do Next);
 * - avisa quando a conexao cai, sem alarme: offline nao e erro do usuario;
 * - sobe a fila de progresso quando a conexao volta e diz o que subiu.
 *
 * Nada aqui usa vermelho. Ficar sem rede nao e falha de quem esta estudando.
 */
export function SincronizacaoOffline() {
  const router = useRouter()
  const [offline, setOffline] = useState(false)
  const [naFila, setNaFila] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [enviados, setEnviados] = useState(0)

  const atualizarFila = useCallback(() => {
    setNaFila(pendentes())
  }, [])

  const subirFila = useCallback(async () => {
    if (pendentes() === 0) return

    setEnviando(true)
    const resultado = await sincronizar()
    setEnviando(false)
    setNaFila(resultado.restantes)

    if (resultado.enviados > 0) {
      setEnviados(resultado.enviados)
      // O progresso que subiu precisa aparecer nas telas já renderizadas.
      router.refresh()
      setTimeout(() => setEnviados(0), 6000)
    }
  }, [router])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sem service worker a plataforma continua inteira: só não lê offline.
      })
    }

    setOffline(!navigator.onLine)
    atualizarFila()
    void subirFila()

    function aoConectar() {
      setOffline(false)
      void subirFila()
    }

    function aoDesconectar() {
      setOffline(true)
    }

    window.addEventListener('online', aoConectar)
    window.addEventListener('offline', aoDesconectar)
    // A fila também cresce por outras telas: reconferir ao voltar para a aba.
    window.addEventListener('focus', atualizarFila)

    return () => {
      window.removeEventListener('online', aoConectar)
      window.removeEventListener('offline', aoDesconectar)
      window.removeEventListener('focus', atualizarFila)
    }
  }, [atualizarFila, subirFila])

  if (!offline && naFila === 0 && enviados === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={juntar(
        'fixed inset-x-0 bottom-14 z-40 mx-auto max-w-md px-4 md:bottom-4',
        'pointer-events-none',
      )}
    >
      <div
        className={juntar(
          'pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-sm',
          offline ? 'border-line bg-surface-sunken text-ink' : 'border-ok/40 bg-ok-soft text-ok-ink',
        )}
      >
        {offline ? (
          <p>
            Sem conexão.{' '}
            {naFila > 0
              ? `${naFila} ${naFila === 1 ? 'registro fica guardado' : 'registros ficam guardados'} e sobem quando a rede voltar.`
              : 'Módulos baixados continuam disponíveis em Leitura offline.'}
          </p>
        ) : enviando ? (
          <p>Enviando o que ficou pendente…</p>
        ) : enviados > 0 ? (
          <p>
            {enviados} {enviados === 1 ? 'registro sincronizado' : 'registros sincronizados'}.
          </p>
        ) : (
          <p>
            {naFila} {naFila === 1 ? 'registro aguardando envio' : 'registros aguardando envio'}.{' '}
            <button
              type="button"
              onClick={subirFila}
              className="text-accent-ink font-medium underline underline-offset-2"
            >
              Enviar agora
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
