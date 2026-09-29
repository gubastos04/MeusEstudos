// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { BlocoQuiz } from '@/components/bloco-quiz'
import { Campo } from '@/components/campos'
import { MarkdownSimples } from '@/components/markdown-simples'
import { TextoInline } from '@/components/texto-inline'

/**
 * Componentes de conteudo.
 *
 * Duas coisas sao verificadas aqui:
 * 1. o texto do conteudo e a resposta da IA nunca viram HTML — a plataforma
 *    renderiza elementos React, e marcacao que chegar como texto tem de
 *    aparecer como texto;
 * 2. o checkpoint dentro da aula se comporta como exercicio, nao como prova:
 *    mostra a resposta na hora e permite tentar de novo.
 */

afterEach(cleanup)

describe('marcação inline do conteúdo', () => {
  it('renderiza código, negrito e link', () => {
    const { container } = render(
      <TextoInline texto="Use `resposta.ok` antes de **converter** o corpo. Veja [a documentação](https://exemplo.test/doc)." />,
    )

    expect(container.querySelector('code')?.textContent).toEqual('resposta.ok')
    expect(container.querySelector('strong')?.textContent).toEqual('converter')

    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toEqual('https://exemplo.test/doc')
    // Link externo não pode dar acesso à janela de origem.
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('mantém o texto puro quando não há marcação', () => {
    render(<TextoInline texto="Uma frase comum, sem marcação nenhuma." />)
    expect(screen.getByText('Uma frase comum, sem marcação nenhuma.')).toBeTruthy()
  })

  it('não transforma HTML do conteúdo em elemento', () => {
    const { container } = render(<TextoInline texto="<img src=x onerror=alert(1)>" />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('checkpoint dentro da aula', () => {
  const propriedades = {
    pergunta: 'Qual é a negação de `A and B`?',
    alternativas: ['not A and not B', 'not A or not B', 'A or B'],
    indiceCorreto: 1,
    explicacao: 'A negação de um E é um OU com as partes negadas.',
  }

  it('não mostra a resposta antes de responder', () => {
    render(<BlocoQuiz {...propriedades} />)

    expect(screen.queryByText(/negação de um E/)).toBeNull()
    expect(screen.queryByText('correta')).toBeNull()
  })

  it('ao errar, mostra a alternativa certa, explica e deixa tentar de novo', async () => {
    const usuario = userEvent.setup()
    render(<BlocoQuiz {...propriedades} />)

    await usuario.click(screen.getByText('not A and not B'))

    expect(screen.getByText(/A alternativa correta é B/)).toBeTruthy()
    expect(screen.getByText(/negação de um E/)).toBeTruthy()

    const tentarDeNovo = screen.getByText('Tentar de novo')
    await usuario.click(tentarDeNovo)

    // Volta ao estado inicial: exercício não registra fracasso.
    expect(screen.queryByText(/A alternativa correta é B/)).toBeNull()
  })

  it('ao acertar, confirma sem elogio e sem oferecer nova tentativa', async () => {
    const usuario = userEvent.setup()
    render(<BlocoQuiz {...propriedades} />)

    await usuario.click(screen.getByText('not A or not B'))

    expect(screen.getByText('Correto.')).toBeTruthy()
    expect(screen.queryByText('Tentar de novo')).toBeNull()
    // Tom de voz: nada de "Parabéns!" nem de entusiasmo artificial.
    expect(document.body.textContent).not.toMatch(/parabéns|incrível|excelente/i)
  })
})

describe('resposta da IA', () => {
  it('renderiza título, lista e bloco de código', () => {
    const resposta = [
      '## O que está acontecendo',
      '',
      'A comparação é literal.',
      '',
      '- verifique o valor gravado no banco',
      '- normalize os dois lados',
      '',
      '```python',
      'if status.lower() == "pending":',
      '```',
    ].join('\n')

    const { container } = render(<MarkdownSimples texto={resposta} />)

    expect(screen.getByText('O que está acontecendo')).toBeTruthy()
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.textContent).toContain('if status.lower()')
  })

  it('renderiza lista numerada', () => {
    const { container } = render(<MarkdownSimples texto={'1. medir\n2. corrigir\n3. medir de novo'} />)

    expect(container.querySelector('ol')).not.toBeNull()
    expect(container.querySelectorAll('li')).toHaveLength(3)
  })

  it('não executa HTML vindo da resposta', () => {
    const { container } = render(<MarkdownSimples texto={'<script>alert(1)</script> e <b>negrito</b>'} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })

  it('aproveita o que veio mesmo com cerca de código não fechada', () => {
    const { container } = render(<MarkdownSimples texto={'Exemplo:\n```js\nconst a = 1'} />)

    expect(container.textContent).toContain('const a = 1')
  })
})

describe('campo de senha', () => {
  it('começa oculto e revela ao pedir', async () => {
    const usuario = userEvent.setup()
    render(<Campo rotulo="Senha" type="password" obrigatorio defaultValue="minha-senha-1234" />)

    const campo = screen.getByLabelText(/Senha/)
    expect(campo.getAttribute('type')).toEqual('password')

    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campo.getAttribute('type')).toEqual('text')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(campo.getAttribute('type')).toEqual('password')
  })

  it('o nome acessível diz a ação, não só "Mostrar"', () => {
    render(<Campo rotulo="Senha" type="password" />)

    // Botão sem contexto ("Mostrar") não diz nada a quem navega por lista de
    // controles. O sufixo oculto completa o nome sem alargar o botão na tela.
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeTruthy()
  })

  it('campo comum não ganha botão nenhum', () => {
    render(<Campo rotulo="Email" type="email" />)

    expect(screen.queryByRole('button')).toBeNull()
  })
})
