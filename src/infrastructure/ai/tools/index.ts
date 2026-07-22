import { Pool } from 'pg'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum } from '@app/libs'
import { AiToolDefinition } from '../ai.types'
import { buildRunReadonlyQueryTool } from './run-readonly-query.tool'
import { buildCancelTrainingTool } from './cancel-training.tool'
import { buildActivateTrainingTool } from './activate-training.tool'
import { buildNotifyMaintainerTool } from './notify-maintainer.tool'
import { buildNotifyAdminTool } from './notify-admin.tool'

export interface BuildToolsDeps {
  groupService: GroupService
  trainingService: TrainingService
  userProfileService: UserProfileService
  readonlyPool: Pool
  botToken: string
  maintainerChatId: string
}

const CLIENT_FACING_ROLES: string[] = [UserProfileRoleEnum.CLIENT, UserProfileRoleEnum.GUEST]

// Only admin/maintainer/trainer can reach the AI assistant today (gated at the composer level),
// so in practice this always returns the admin set — but the split is here so opening the
// assistant to clients/guests later (see AiAssistantService's constructor comment) is just
// wiring up their entry point, not redesigning tool access from scratch.
export function buildToolsForActor(actorRole: string, deps: BuildToolsDeps): AiToolDefinition[] {
  const { groupService, trainingService, userProfileService, readonlyPool, botToken, maintainerChatId } = deps

  if (CLIENT_FACING_ROLES.includes(actorRole)) {
    return [buildNotifyAdminTool({ botToken, userProfileService })]
  }

  return [
    buildRunReadonlyQueryTool({ readonlyPool }),
    buildCancelTrainingTool({ groupService, trainingService }),
    buildActivateTrainingTool({ groupService, trainingService }),
    buildNotifyMaintainerTool({ botToken, maintainerChatId }),
  ]
}

export { RUN_READONLY_QUERY_STATIC_DESCRIPTION } from './run-readonly-query.tool'
export { getSchemaSummary } from './schema-summary.provider'
