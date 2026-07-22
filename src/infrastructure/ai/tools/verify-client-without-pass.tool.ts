import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogEntity, AuditLogOperation, UserProfileStatusEnum } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildVerifyClientWithoutPassTool(deps: { userProfileService: UserProfileService }): AiToolDefinition {
  const { userProfileService } = deps

  return {
    name: 'verify_client_without_pass',
    description:
      "Approve a pending client verification request (without issuing a pass) — activates the user's account and creates their client record. Only works if the person's role is client and their status is verification_requested. Always resolve the exact userProfileId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        userProfileId: { type: 'string', description: 'The user_profile id of the pending client.' },
      },
      required: ['userProfileId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { userProfileId: string }) => {
      const user = await userProfileService.getUserProfileById(input.userProfileId)
      return `⚠️ Верифікувати клієнта ${user.fullName} без абонемента? Обліковий запис стане активним.`
    },
    successMessage: '✅ Клієнта верифіковано.',
    execute: async (_actor, input: { userProfileId: string }) => {
      const success = await userProfileService.verifyClientWithoutPass(input.userProfileId)

      if (!success) {
        throw new Error('Неможливо верифікувати: очікується роль client у статусі verification_requested.')
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
            metadata: { serviceName: UserProfileService.name, methodName: 'verifyClientWithoutPass' },
          },
        ],
      }
    },
  }
}
