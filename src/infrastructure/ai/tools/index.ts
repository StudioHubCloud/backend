import { Pool } from 'pg'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum } from '@app/libs'
import { AiToolDefinition } from '../ai.types'
import { buildRunReadonlyQueryTool } from './run-readonly-query.tool'
import { buildCancelTrainingTool } from './cancel-training.tool'
import { buildActivateTrainingTool } from './activate-training.tool'
import { buildNotifyMaintainerTool } from './notify-maintainer.tool'
import { buildNotifyAdminTool } from './notify-admin.tool'
import { buildAssignSubstituteTrainerTool } from './assign-substitute-trainer.tool'
import { buildDeassignSubstituteTrainerTool } from './deassign-substitute-trainer.tool'
import { buildAssignGroupStaffMemberTool } from './assign-group-staff-member.tool'
import { buildDeassignGroupStaffMemberTool } from './deassign-group-staff-member.tool'
import { buildSignInClientToTrainingTool } from './sign-in-client-to-training.tool'
import { buildVerifyClientWithoutPassTool } from './verify-client-without-pass.tool'
import { buildVerifyTrainerTool } from './verify-trainer.tool'
import { buildRejectVerificationRequestTool } from './reject-verification-request.tool'
import { buildEditClientTool } from './edit-client.tool'

export interface BuildToolsDeps {
  groupService: GroupService
  trainingService: TrainingService
  trainingSignupService: TrainingSignupService
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
  const { groupService, trainingService, trainingSignupService, userProfileService, readonlyPool, botToken, maintainerChatId } = deps

  if (CLIENT_FACING_ROLES.includes(actorRole)) {
    return [buildNotifyAdminTool({ botToken, userProfileService })]
  }

  return [
    buildRunReadonlyQueryTool({ readonlyPool }),
    buildCancelTrainingTool({ groupService, trainingService }),
    buildActivateTrainingTool({ groupService, trainingService }),
    buildAssignSubstituteTrainerTool({ groupService, trainingService, userProfileService }),
    buildDeassignSubstituteTrainerTool({ groupService, trainingService }),
    buildAssignGroupStaffMemberTool({ groupService, userProfileService }),
    buildDeassignGroupStaffMemberTool({ groupService }),
    buildSignInClientToTrainingTool({ groupService, trainingService, trainingSignupService, userProfileService }),
    buildVerifyClientWithoutPassTool({ userProfileService }),
    buildVerifyTrainerTool({ userProfileService }),
    buildRejectVerificationRequestTool({ userProfileService }),
    buildEditClientTool({ userProfileService }),
    buildNotifyMaintainerTool({ botToken, maintainerChatId }),
  ]
}

export { RUN_READONLY_QUERY_STATIC_DESCRIPTION } from './run-readonly-query.tool'
export { getSchemaSummary } from './schema-summary.provider'
