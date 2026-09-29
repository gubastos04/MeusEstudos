import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { findItem, getChallenge, getDemand, getProject } from '@/lib/content/loader'
import { completeProgress, logEvent, startProgress, touchProgress } from '@/lib/progress'

/**
 * Progresso do usuario.
 *
 * O userId vem sempre da sessao. O cliente informa apenas qual conteudo, e o
 * servidor confere que esse conteudo existe antes de registrar qualquer coisa.
 */

const schema = z.object({
  acao: z.enum(['iniciar', 'salvar', 'concluir', 'abandonar']),
  tipo: z.enum(['lesson', 'checkpoint', 'exercise', 'assessment', 'demand', 'project', 'project-step', 'challenge']),
  id: z.string().min(1).max(80),
  moduloId: z.string().max(80).optional(),
  /** Bloco onde a pessoa parou, para retomada exata. */
  bloco: z.number().int().min(0).max(500).optional(),
  /** Segundos desta sessao de estudo. O servidor limita o valor. */
  segundos: z.number().int().min(0).max(7200).optional(),
  /**
   * Momento em que o evento aconteceu no aparelho. Vem preenchido quando o
   * registro ficou na fila offline: permite nao mover o ponto de parada para
   * tras ao subir um evento antigo.
   */
  ocorridoEm: z.string().datetime().optional(),
})

export const POST = handler({ schema }, async ({ user, body }) => {
  const existe = conteudoExiste(body.tipo, body.id)
  if (!existe) {
    return fail('Conteúdo não encontrado.', 404)
  }

  const comum = {
    userId: user.id,
    nodeType: body.tipo,
    nodeId: body.id,
    moduleId: body.moduloId ?? existe.moduloId ?? null,
  }

  const ocorridoEm = body.ocorridoEm ? new Date(body.ocorridoEm) : null

  switch (body.acao) {
    case 'iniciar': {
      await startProgress(comum)
      await logEvent({ userId: user.id, type: 'content_started', nodeType: body.tipo, nodeId: body.id })
      return ok({ estado: 'in_progress' })
    }

    case 'salvar': {
      await touchProgress({
        ...comum,
        resumeBlock: body.bloco,
        addSeconds: body.segundos,
        occurredAt: ocorridoEm,
      })
      return ok({ estado: 'in_progress' })
    }

    case 'concluir': {
      await completeProgress({ ...comum, addSeconds: body.segundos })
      return ok({ estado: 'completed' })
    }

    case 'abandonar': {
      // Sair no meio e estado legitimo: registra onde parou e nada mais.
      await touchProgress({
        ...comum,
        resumeBlock: body.bloco,
        addSeconds: body.segundos,
        occurredAt: ocorridoEm,
      })
      await logEvent({
        userId: user.id,
        type: 'content_abandoned',
        nodeType: body.tipo,
        nodeId: body.id,
        meta: { bloco: body.bloco ?? 0 },
      })
      return ok({ estado: 'in_progress' })
    }
  }
})

/** Confere a existencia do conteudo e devolve o modulo, quando houver. */
function conteudoExiste(tipo: string, id: string): { moduloId?: string } | null {
  switch (tipo) {
    case 'lesson':
    case 'checkpoint': {
      const encontrado = findItem(id)
      return encontrado ? { moduloId: encontrado.module.id } : null
    }
    case 'demand':
      // Demandas geradas por IA existem apenas no banco; o registro de progresso
      // delas passa pela rota de demandas, que valida a propriedade.
      return getDemand(id) ? {} : { moduloId: undefined }
    case 'project':
    case 'project-step':
      return getProject(id.split('::')[0] ?? id) ? {} : null
    case 'challenge':
      return getChallenge(id) ? {} : null
    case 'assessment':
    case 'exercise':
      // Registrados pelas rotas proprias, que validam o conteudo.
      return {}
    default:
      return null
  }
}
