import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogEntity, AuditLogOperation, UserProfileStatusEnum } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildVerifyTrainerTool(deps: { userProfileService: UserProfileService }): AiToolDefinition {
  const { userProfileService } = deps

  return {
    name: 'verify_trainer',
    description:
      "Approve a pending trainer verification request — activates the user's account and creates their staff_member record. Only works if the person's role is trainer and their status is verification_requested. Always resolve the exact userProfileId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        userProfileId: { type: 'string', description: 'The user_profile id of the pending trainer.' },
      },
      required: ['userProfileId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { userProfileId: string }) => {
      const user = await userProfileService.getUserProfileById(input.userProfileId)
      return `⚠️ Верифікувати тренера ${user.fullName}? Обліковий запис стане активним.`
    },
    successMessage: '✅ Тренера верифіковано.',
    execute: async (_actor, input: { userProfileId: string }) => {
      const success = await userProfileService.verifyTrainer(input.userProfileId)

      if (!success) {
        throw new Error('Неможливо верифікувати: очікується роль trainer у статусі verification_requested.')
      }

      return {
        result: { userProfileId: input.userProfileId, verified: true },
        logOperations: [
          {
            entity: AuditLogEntity.USER_PROFILE,
            entityId: input.userProfileId,
            operation: AuditLogOperation.UPDATE,
            payload: { status: UserProfileStatusEnum.ACTIVE },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: UserProfileService.name, methodName: 'verifyTrainer' },
          },
        ],
      }
    },
  }
}
