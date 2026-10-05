import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { API, AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildSignInClientToTrainingTool(deps: {
  groupService: GroupService
  trainingService: TrainingService
  trainingSignupService: TrainingSignupService
  userProfileService: UserProfileService
}): AiToolDefinition {
  const { groupService, trainingService, trainingSignupService, userProfileService } = deps

  return {
    name: 'sign_in_client_to_training',
    description:
      "Sign a client up for a specific training using one of their active group passes (a pass is bound to one group, or FLEX for any group). A pass covering the training's group is used automatically. If the client has none, the call fails with a list of their other valid passes (passId — name): ask the admin which one to charge and call again with that passId. Fails if the training is cancelled, the client is already signed up, or they have no valid group pass with an available slot. Always resolve the exact trainingId and clientUserId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        trainingId: { type: 'integer', description: 'The training id.' },
        clientUserId: { type: 'string', description: "The client's user_profile id." },
        passId: {
          type: 'string',
          description: 'Only after a failed call listed passes: the pass the admin chose to charge (a pass of another group).',
        },
      },
      required: ['trainingId', 'clientUserId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { trainingId: number; clientUserId: string; passId?: string }) => {
      const training = await trainingService.getTrainingById(input.trainingId)
      const group = await groupService.getGroupById(training.groupId)
      const client = await userProfileService.getUserProfileById(input.clientUserId)
      const otherGroupWarning = input.passId
        ? `\n⚠️ У клієнта немає абонемента для цієї групи: тренування спишеться з обраного абонемента.`
        : ''
      return `⚠️ Записати ${client.fullName} на "${group.name}" ${training.date}?${otherGroupWarning}`
    },
    successMessage: '✅ Клієнта записано на тренування.',
    execute: async (_actor, input: { trainingId: number; clientUserId: string; passId?: string }) => {
      const result = await trainingSignupService.signInToTrainingAsAdminViaTelegram(input.clientUserId, input.trainingId, input.passId)

      if (result.passChoice) {
        const options = result.passChoice.map((pass) => `${pass.id} — ${pass.name}`).join('\n')
        throw new Error(`${result.message}\nAsk the admin which pass to charge, then call again with passId:\n${options}`)
      }

      // This service method reports failures via a {status, message} response instead of
      // throwing, unlike cancelTrainingById/etc. — translate to a thrown error here so the
      // existing catch/is_error plumbing in AiAssistantService still applies uniformly.
      if (result.status === API.RESPONSE.ERROR_STRING) {
        throw new Error(result.message)
      }

      return {
        result: { trainingId: input.trainingId, clientUserId: input.clientUserId, signedUp: true },
        logOperations: [
          {
            entity: AuditLogEntity.TRAINING_SIGNUP,
            entityId: `${input.trainingId}:${input.clientUserId}`,
            operation: AuditLogOperation.CREATE,
            payload: { trainingId: input.trainingId, userProfileId: input.clientUserId },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: TrainingSignupService.name, methodName: 'signInToTrainingAsAdminViaTelegram' },
          },
        ],
      }
    },
  }
}
