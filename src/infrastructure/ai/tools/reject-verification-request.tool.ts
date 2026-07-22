import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogEntity, AuditLogOperation, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildRejectVerificationRequestTool(deps: { userProfileService: UserProfileService }): AiToolDefinition {
  const { userProfileService } = deps

  return {
    name: 'reject_verification_request',
    description:
      "Reject a pending client/trainer verification request — reverts the person to an unverified guest. Reversible: they can submit a new verification request afterward. Always resolve the exact userProfileId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        userProfileId: { type: 'string', description: 'The user_profile id of the pending verification request.' },
      },
      required: ['userProfileId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { userProfileId: string }) => {
      const user = await userProfileService.getUserProfileById(input.userProfileId)
      return `⚠️ Відхилити запит на верифікацію від ${user.fullName}? Вони зможуть подати новий запит пізніше.`
    },
    successMessage: '✅ Запит на верифікацію відхилено.',
    execute: async (_actor, input: { userProfileId: string }) => {
      await userProfileService.rejectVerificationRequest(input.userProfileId)

      return {
        result: { userProfileId: input.userProfileId, rejected: true },
        logOperations: [
          {
            entity: AuditLogEntity.USER_PROFILE,
            entityId: input.userProfileId,
            operation: AuditLogOperation.UPDATE,
            payload: { status: UserProfileStatusEnum.UNVERIFIED, role: UserProfileRoleEnum.GUEST },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: UserProfileService.name, methodName: 'rejectVerificationRequest' },
          },
        ],
      }
    },
  }
}
