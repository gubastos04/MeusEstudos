import { describe, expect, it } from 'vitest'

import { stripTypes } from '@/lib/runner/run-js'

/**
 * Remocao de tipos antes de executar um exercicio em TypeScript.
 *
 * Nao existe compilador embarcado: a plataforma remove as anotacoes e executa
 * o JavaScript que sobra. Estes testes travam o que ela precisa dar conta — e
 * documentam, no fim, o limite conhecido.
 *
 * A verificacao vai alem de comparar texto: o resultado e executado, porque o
 * que importa e o codigo rodar.
 */

function executar(codigo: string, expressao: string): unknown {
  const fabrica = new Function(`"use strict";\n${stripTypes(codigo)}\n;return (${expressao})`)
  return fabrica()
}

describe('anotações em funções', () => {
  it('remove tipos de parâmetro e de retorno', () => {
    const codigo = `function dobro(valor: number): number {
  return valor * 2
}`

    expect(executar(codigo, 'dobro(21)')).toBe(42)
  })

  it('remove tipo de variável', () => {
    const codigo = `function somar(itens: number[]): number {
  let soma: number = 0
  for (const item of itens) soma += item
  return soma
}`

    expect(executar(codigo, 'somar([1, 2, 3])')).toBe(6)
  })

  it('remove união com null, que é o tipo mais usado nos exercícios', () => {
    const codigo = `function nome(valor: string | null): string {
  return valor === null ? 'sem nome' : valor
}`

    expect(executar(codigo, "nome(null)")).toBe('sem nome')
    expect(executar(codigo, "nome('Ana')")).toBe('Ana')
  })
})

describe('declarações de tipo', () => {
  it('remove interface escrita em várias linhas', () => {
    const codigo = `interface Item {
  preco: number
  quantidade: number
}

function total(itens: Item[]): number {
  return itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
}`

    expect(executar(codigo, 'total([{ preco: 10, quantidade: 2 }])')).toBe(20)
  })

  it('remove interface escrita em uma linha só', () => {
    // Este caso quebrava com SyntaxError: a declaração sobrava no código.
    const codigo =
      'interface Item { preco: number; quantidade: number } function total(itens: Item[]): number { return itens.length }'

    expect(executar(codigo, 'total([{ preco: 1, quantidade: 1 }])')).toBe(1)
  })

  it('remove alias de tipo', () => {
    const codigo = `type Status = 'aberto' | 'fechado'

function ehAberto(status: Status): boolean {
  return status === 'aberto'
}`

    expect(executar(codigo, "ehAberto('aberto')")).toBe(true)
  })

  it('não confunde alias de tipo com atribuição de propriedade', () => {
    // `item.type = ...` é código comum e não pode ser apagado.
    const codigo = `function marcar(item) {
  item.type = 'lesson'
  return item
}`

    expect(executar(codigo, "marcar({}).type")).toBe('lesson')
  })
})

describe('outras formas', () => {
  it('remove asserção com as', () => {
    const codigo = `function ler(dados) {
  const texto = dados as string
  return texto.length
}`

    expect(executar(codigo, "ler('abc')")).toBe(3)
  })

  it('remove o operador de asserção não-nulo', () => {
    const codigo = `function primeiro(lista) {
  return lista[0]!.nome
}`

    expect(executar(codigo, "primeiro([{ nome: 'Ana' }])")).toBe('Ana')
  })

  it('não altera JavaScript puro', () => {
    const codigo = `function saudar(nome) {
  return 'olá, ' + nome
}`

    expect(stripTypes(codigo)).toBe(codigo)
  })
})

describe('limite conhecido', () => {
  it('não dá conta de interface com objeto aninhado', () => {
    // Documentado de propósito: quando isso mudar, o teste avisa.
    // A mensagem de erro da plataforma explica o caso para quem estuda.
    const codigo = 'interface A { b: { c: number } }\nfunction f(): number { return 1 }'

    expect(stripTypes(codigo)).toContain('interface')
  })
})
