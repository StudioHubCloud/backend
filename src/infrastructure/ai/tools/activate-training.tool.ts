import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildActivateTrainingTool(deps: { groupService: GroupService; trainingService: TrainingService }): AiToolDefinition {
  const { groupService, trainingService } = deps

  return {
    name: 'activate_training',
    description:
      'Reactivate a previously cancelled training by trainingId — undoes cancel_training and also restores the sign-ups that were cancelled along with it. Only works on trainings that are currently cancelled and still upcoming. Always resolve the exact trainingId (e.g. via run_readonly_query) before calling this.',
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
      return `⚠️ Активувати тренування "${group.name}" ${training.date}?\nЗаписи, скасовані разом із ним, теж відновляться.`
    },
    successMessage: '✅ Тренування активовано.',
    execute: async (_actor, input: { trainingId: number }) => {
      const { training } = await trainingService.activateTrainingById(input.trainingId)

      return {
        result: { trainingId: training.id, activated: true },
        logOperations: [
          {
            entity: AuditLogEntity.TRAINING,
            entityId: String(training.id),
            operation: AuditLogOperation.UPDATE,
            payload: { isCancelled: false },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: TrainingService.name, methodName: 'activateTrainingById' },
          },
        ],
      }
    },
  }
}
