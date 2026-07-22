import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildCancelTrainingTool(deps: { groupService: GroupService; trainingService: TrainingService }): AiToolDefinition {
  const { groupService, trainingService } = deps

  return {
    name: 'cancel_training',
    description:
      'Cancel a training by trainingId. This also cancels all active sign-ups for that training. Irreversible — always resolve the exact trainingId (e.g. via run_readonly_query) before calling this.',
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
      return (
        `⚠️ Cancel training "${group.name}" on ${training.date}?\n` +
        `This will also cancel all active sign-ups for it. This cannot be undone.`
      )
    },
    successMessage: '✅ Training cancelled.',
    execute: async (_actor, input: { trainingId: number }) => {
      const { training } = await trainingService.cancelTrainingById(input.trainingId)

      return {
        result: { trainingId: training.id, cancelled: true },
        logOperations: [
          {
            entity: AuditLogEntity.TRAINING,
            entityId: String(training.id),
            operation: AuditLogOperation.UPDATE,
            payload: { isCancelled: true },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: TrainingService.name, methodName: 'cancelTrainingById' },
          },
        ],
      }
    },
  }
}
