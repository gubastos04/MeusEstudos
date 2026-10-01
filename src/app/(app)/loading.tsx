import { Carregando, Cartao } from '@/components/ui'

/**
 * Esqueleto das telas autenticadas.
 *
 * Por que existe: sem ele a navegacao nao tinha nenhum sinal de carregamento.
 * Localmente isso e invisivel (as paginas respondem em dezenas de
 * milissegundos), mas o primeiro acesso em producao mediu 784ms de TTFB — e
 * nesse intervalo a tela anterior ficava congelada, sem dizer que o clique
 * registrou.
 *
 * O formato imita a moldura da pagina (titulo, subtitulo, cartoes) para o
 * conteudo real nao fazer o layout pular quando chega. A animacao vem da classe
 * `.esqueleto`, que ja para sozinha em `prefers-reduced-motion`.
 *
 * Um unico `Carregando` na arvore: ele carrega o aviso em `sr-only` com
 * `aria-live`, e repetir o componente faria o leitor de tela anunciar duas
 * vezes. Os demais blocos sao forma, sem texto.
 */
export default function Carregamento() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="esqueleto h-7 w-56" />
        <div className="esqueleto h-4 w-full max-w-md" />
      </div>

      <Cartao>
        <Carregando linhas={3} />
      </Cartao>

      <Cartao className="space-y-2">
        <div className="esqueleto h-4 w-5/6" />
        <div className="esqueleto h-4 w-2/3" />
      </Cartao>
    </div>
  )
}
