'use client'

import { BlocoCodigo } from './bloco-codigo'
import { renderizarInline } from './texto-inline'

/**
 * Renderizador de markdown minimo, usado nas respostas da IA.
 *
 * Suporta titulo (##), lista com marcador, lista numerada, bloco de codigo com
 * cerca e a marcacao inline do proprio produto.
 *
 * Decisao de seguranca: nada aqui usa dangerouslySetInnerHTML. A resposta da IA
 * e texto externo; tratada como HTML, seria uma porta de XSS.
 */

type Bloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'lista'; itens: string[]; ordenada: boolean }
  | { tipo: 'codigo'; linguagem: string; codigo: string }

export function MarkdownSimples({ texto }: { texto: string }) {
  const blocos = analisar(texto)

  return (
    <div className="space-y-3">
      {blocos.map((bloco, indice) => {
        switch (bloco.tipo) {
          case 'titulo':
            return (
              <h4 key={indice} className="text-ink text-sm font-semibold">
                {renderizarInline(bloco.texto)}
              </h4>
            )
          case 'paragrafo':
            return (
              <p key={indice} className="text-ink text-sm leading-relaxed">
                {renderizarInline(bloco.texto)}
              </p>
            )
          case 'lista': {
            const Lista = bloco.ordenada ? 'ol' : 'ul'
            return (
              <Lista
                key={indice}
                className={
                  bloco.ordenada
                    ? 'text-ink marker:text-ink-faint list-decimal space-y-1 pl-5 text-sm'
                    : 'text-ink marker:text-ink-faint list-disc space-y-1 pl-5 text-sm'
                }
              >
                {bloco.itens.map((item, posicao) => (
                  <li key={posicao} className="leading-relaxed">
                    {renderizarInline(item)}
                  </li>
                ))}
              </Lista>
            )
          }
          case 'codigo':
            return <BlocoCodigo key={indice} codigo={bloco.codigo} linguagem={bloco.linguagem || 'text'} />
        }
      })}
    </div>
  )
}

function analisar(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  const blocos: Bloco[] = []

  let paragrafo: string[] = []
  let lista: string[] = []
  let listaOrdenada = false
  let dentroDeCodigo = false
  let linguagem = ''
  let codigo: string[] = []

  function fecharParagrafo() {
    if (paragrafo.length > 0) {
      blocos.push({ tipo: 'paragrafo', texto: paragrafo.join(' ').trim() })
      paragrafo = []
    }
  }

  function fecharLista() {
    if (lista.length > 0) {
      blocos.push({ tipo: 'lista', itens: lista, ordenada: listaOrdenada })
      lista = []
    }
  }

  for (const linha of linhas) {
    const cerca = linha.match(/^```\s*(\w+)?\s*$/)

    if (cerca) {
      if (dentroDeCodigo) {
        blocos.push({ tipo: 'codigo', linguagem, codigo: codigo.join('\n') })
        codigo = []
        linguagem = ''
        dentroDeCodigo = false
      } else {
        fecharParagrafo()
        fecharLista()
        dentroDeCodigo = true
        linguagem = cerca[1] ?? ''
      }
      continue
    }

    if (dentroDeCodigo) {
      codigo.push(linha)
      continue
    }

    if (linha.trim() === '') {
      fecharParagrafo()
      fecharLista()
      continue
    }

    const titulo = linha.match(/^#{1,4}\s+(.*)$/)
    if (titulo) {
      fecharParagrafo()
      fecharLista()
      blocos.push({ tipo: 'titulo', texto: titulo[1] ?? '' })
      continue
    }

    const marcador = linha.match(/^\s*[-*]\s+(.*)$/)
    if (marcador) {
      fecharParagrafo()
      if (listaOrdenada) fecharLista()
      listaOrdenada = false
      lista.push(marcador[1] ?? '')
      continue
    }

    const numerado = linha.match(/^\s*\d+[.)]\s+(.*)$/)
    if (numerado) {
      fecharParagrafo()
      if (!listaOrdenada) fecharLista()
      listaOrdenada = true
      lista.push(numerado[1] ?? '')
      continue
    }

    fecharLista()
    paragrafo.push(linha.trim())
  }

  // Cerca de codigo nao fechada: aproveita o que veio, sem descartar a resposta.
  if (dentroDeCodigo && codigo.length > 0) {
    blocos.push({ tipo: 'codigo', linguagem, codigo: codigo.join('\n') })
  }

  fecharParagrafo()
  fecharLista()

  return blocos
}
