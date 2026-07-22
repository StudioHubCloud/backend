import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildAssignSubstituteTrainerTool(deps: {
  groupService: GroupService
  trainingService: TrainingService
  userProfileService: UserProfileService
}): AiToolDefinition {
  const { groupService, trainingService, userProfileService } = deps

  return {
    name: 'assign_substitute_trainer',
    description:
      "Assign a substitute trainer to a specific training (doesn't change the group's regular trainer, just this one training). staffUserId is the trainer's user_profile id, not a staff_member id. Always resolve the exact trainingId and staffUserId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        trainingId: { type: 'integer', description: 'The training id.' },
        staffUserId: { type: 'string', description: "The substitute trainer's user_profile id." },
      },
      required: ['trainingId', 'staffUserId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { trainingId: number; staffUserId: string }) => {
      const training = await trainingService.getTrainingById(input.trainingId)
      const group = await groupService.getGroupById(training.groupId)
      const substitute = await userProfileService.getUserProfileById(input.staffUserId)
      return `⚠️ Призначити ${substitute.fullName} тимчасовим тренером на "${group.name}" ${training.date}?`
    },
    successMessage: '✅ Тимчасового тренера призначено.',
    execute: async (_actor, input: { trainingId: number; staffUserId: string }) => {
      const training = await trainingService.assignSubstituteTrainer(input.trainingId, input.staffUserId)

      return {
        result: { trainingId: input.trainingId, staffUserId: input.staffUserId, assigned: true },
        logOperations: [
          {
            entity: AuditLogEntity.TRAINING,
            entityId: String(training.id),
            operation: AuditLogOperation.UPDATE,
            payload: { trainerId: training.trainerId },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: TrainingService.name, methodName: 'assignSubstituteTrainer' },
          },
        ],
      }
    },
  }
}
