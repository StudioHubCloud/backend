import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildDeassignSubstituteTrainerTool(deps: {
  groupService: GroupService
  trainingService: TrainingService
}): AiToolDefinition {
  const { groupService, trainingService } = deps

  return {
    name: 'deassign_substitute_trainer',
    description:
      "Remove a training's substitute trainer, reverting it back to the group's regular trainer. Always resolve the exact trainingId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        trainingId: { type: 'integer', description: 'The training id.' },
      },
      required: ['trainingId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { trainingId: number }) => {
      const training = await trainingService.getTrainingById(input.trainingId)
      const group = await groupService.getGroupById(training.groupId)
      const substituteName = training.trainer?.userProfile?.fullName
      const who = substituteName ? `тимчасового тренера ${substituteName}` : 'тимчасового тренера'
      return `⚠️ Зняти ${who} з "${group.name}" ${training.date}? Тренування повернеться до звичайного тренера групи.`
    },
    successMessage: '✅ Тимчасового тренера знято.',
    execute: async (_actor, input: { trainingId: number }) => {
      const training = await trainingService.deassignSubstituteTrainer(input.trainingId)

      return {
        result: { trainingId: training.id, deassigned: true },
        logOperations: [
          {
            entity: AuditLogEntity.TRAINING,
            entityId: String(training.id),
            operation: AuditLogOperation.UPDATE,
            payload: { trainerId: null },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: TrainingService.name, methodName: 'deassignSubstituteTrainer' },
          },
        ],
      }
    },
  }
}
