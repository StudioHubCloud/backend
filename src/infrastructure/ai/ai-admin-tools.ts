import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from './ai.types'

const UPCOMING_TRAININGS_LIMIT = 20

// First slice of admin tools — read-only lookups plus one mutating action (cancel_training).
// Each tool wraps an existing domain service method so validation/business rules stay
// in one place; nothing here re-implements domain logic.
export function buildAdminTools(deps: {
  groupService: GroupService
  trainingService: TrainingService
  trainingSignupService: TrainingSignupService
  userProfileService: UserProfileService
}): AiToolDefinition[] {
  const { groupService, trainingService, trainingSignupService, userProfileService } = deps

  const listUpcomingTrainings: AiToolDefinition = {
    name: 'list_upcoming_trainings',
    description:
      'List upcoming (not cancelled, not yet started) trainings across all active groups, with their training id, date, and group name. Use this to resolve which training the admin means before calling a tool that needs a trainingId.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async () => {
      const groups = await groupService.getAllActiveGroups()
      const nowIso = new Date().toISOString()

      const perGroupTrainings = await Promise.all(
        groups.map(async (group) => {
          const trainings = await trainingService.getTrainingListForManage({ groupId: group.id })
          return trainings
            .filter((training) => !training.isCancelled && training.date >= nowIso)
            .map((training) => ({ trainingId: training.id, date: training.date, groupName: group.name }))
        }),
      )

      const upcoming = perGroupTrainings
        .flat()
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, UPCOMING_TRAININGS_LIMIT)

      return { result: { trainings: upcoming } }
    },
  }

  const getTrainingSignupCount: AiToolDefinition = {
    name: 'get_training_signup_count',
    description: 'Get the number of clients actively signed up for a specific training by its trainingId.',
    inputSchema: {
      type: 'object',
      properties: {
        trainingId: { type: 'integer', description: 'The training id, obtained from list_upcoming_trainings.' },
      },
      required: ['trainingId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async (_actor, input: { trainingId: number }) => {
      const signups = await trainingSignupService.getTrainingActiveSignups(input.trainingId)
      return { result: { trainingId: input.trainingId, activeSignupCount: signups.length } }
    },
  }

  const listClients: AiToolDefinition = {
    name: 'list_clients',
    description: 'List active (non-archived) clients of the studio with their id, name, and status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async () => {
      const clients = await userProfileService.getClientsUserProfiles({ withArchived: false })
      return {
        result: {
          clients: clients.map((client) => ({
            clientId: client.id,
            name: client.fullName || [client.firstName, client.lastName].filter(Boolean).join(' '),
            status: client.status,
          })),
        },
      }
    },
  }

  const cancelTraining: AiToolDefinition = {
    name: 'cancel_training',
    description:
      'Cancel a training by trainingId. This also cancels all active sign-ups for that training. Irreversible — always resolve the exact trainingId (e.g. via list_upcoming_trainings) before calling this.',
    inputSchema: {
      type: 'object',
      properties: {
        trainingId: { type: 'integer', description: 'The training id, obtained from list_upcoming_trainings.' },
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

  return [listUpcomingTrainings, getTrainingSignupCount, listClients, cancelTraining]
}
