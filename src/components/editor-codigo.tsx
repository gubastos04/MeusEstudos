'use client'

import dynamic from 'next/dynamic'

/**
 * Editor de codigo embutido.
 *
 * Decisoes:
 * - CodeMirror, e nao um editor pesado: o celular e o dispositivo principal e o
 *   bundle precisa continuar pequeno;
 * - carregado sob demanda (ssr: false), porque depende de APIs do navegador;
 * - editor e extensoes de linguagem ficam no MESMO modulo carregado sob
 *   demanda, para nao existir mais de uma instancia de @codemirror/state;
 * - enquanto carrega, aparece uma area com o codigo atual, para o layout nao
 *   pular e a pessoa ver o conteudo mesmo em conexao ruim.
 */

const Interno = dynamic(() => import('./editor-codigo-interno'), {
  ssr: false,
  loading: () => (
    <div className="border-line bg-surface-code text-ink-faint rounded border p-3 font-mono text-[13px]">
      Carregando editor…
    </div>
  ),
})

type Props = {
  valor: string
  aoMudar: (valor: string) => void
  linguagem?: string
  somenteLeitura?: boolean
  altura?: number
  rotulo: string
  tamanhoFonte?: number
}

export function EditorCodigo({
  valor,
  aoMudar,
  linguagem = 'text',
  somenteLeitura = false,
  altura = 240,
  rotulo,
  tamanhoFonte = 14,
}: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink text-sm font-medium">{rotulo}</span>
        <span className="text-ink-faint text-xs">{linguagem}</span>
      </div>

      <div
        // CodeMirror renderiza um contenteditable; os leitores de tela anunciam
        // este rotulo ao entrar na regiao.
        role="group"
        aria-label={rotulo}
        style={{ fontSize: tamanhoFonte }}
      >
        <Interno
          valor={valor}
          aoMudar={aoMudar}
          linguagem={linguagem}
          somenteLeitura={somenteLeitura}
          altura={altura}
        />
      </div>
    </div>
  )
}
