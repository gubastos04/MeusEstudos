import { fail, handler, ok } from '@/lib/api'
import { findGlossaryTerm, getModule } from '@/lib/content/loader'

/**
 * Conteudo de um modulo, para leitura offline.
 *
 * Devolve o que a tela de estudo precisa para renderizar sem servidor: itens,
 * blocos, glossario citado e os dados do exercicio.
 *
 * Isto e conteudo do curriculo, nao dado de usuario. Nenhum progresso, nenhuma
 * anotacao e nenhum erro registrado passa por aqui — o que vai para o cache do
 * aparelho precisa ser o material de estudo, e so ele.
 *
 * Exige sessao porque o curriculo e da plataforma; o cache fica no aparelho de
 * quem baixou.
 */

export const GET = handler({}, async ({ params }) => {
  const modulo = getModule(params.id ?? '')

  if (!modulo) {
    return fail('Módulo não encontrado.', 404)
  }

  // Os termos citados vêm junto: offline não há como buscá-los depois.
  const termos = new Map<string, ReturnType<typeof findGlossaryTerm>>()
  for (const item of modulo.items) {
    if (item.type !== 'lesson') continue
    for (const referencia of item.glossary) {
      const termo = findGlossaryTerm(referencia)
      if (termo) termos.set(termo.id, termo)
    }
  }

  return ok({
    modulo: {
      id: modulo.id,
      title: modulo.title,
      summary: modulo.summary,
      outcome: modulo.outcome,
      semester: modulo.semester,
      stack: modulo.stack,
      totalMinutes: modulo.totalMinutes,
      items: modulo.items,
    },
    glossario: [...termos.values()],
    baixadoEm: new Date().toISOString(),
  })
})
