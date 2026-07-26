import { Pool } from 'pg'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { TrainingSignupService } from '@app/domain/training-signup'
import { UserProfileService } from '@app/domain/user-profile'
import { UserProfileRoleEnum } from '@app/libs'
import { KnowledgeBaseService } from '../rag'
import { AiToolDefinition } from '../ai.types'
import { buildRunReadonlyQueryTool } from './run-readonly-query.tool'
import { buildSearchKnowledgeBaseTool } from './search-knowledge-base.tool'
import { buildListStudioScheduleTool } from './list-studio-schedule.tool'
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
  knowledgeBaseService: KnowledgeBaseService
  readonlyPool: Pool
  botToken: string
  maintainerChatId: string
  studioId: string
}

const CLIENT_FACING_ROLES: string[] = [UserProfileRoleEnum.CLIENT, UserProfileRoleEnum.GUEST]

// Only admin/maintainer/trainer can reach the AI assistant today (gated at the composer level) —
// client/guest actors get a real tool set here (KB search + basic schedule browsing), it's just
// unreachable until their entry point is wired up (see AiAssistantService's constructor comment).
//
// Trainer gets the exact same run_readonly_query as admin/maintainer — the "only your own groups/
// trainings/payments" boundary described in the trainer's system prompt persona is enforced by
// instruction, not by this function or the tool itself. A trainer session that gets the model to
// ignore that instruction (bug or prompt injection) could still query anything an admin could.
export function buildToolsForActor(actorRole: string, deps: BuildToolsDeps): AiToolDefinition[] {
  const {
    groupService,
    trainingService,
    trainingSignupService,
    userProfileService,
    knowledgeBaseService,
    readonlyPool,
    botToken,
    maintainerChatId,
    studioId,
  } = deps

  if (CLIENT_FACING_ROLES.includes(actorRole)) {
    return [
      buildNotifyAdminTool({ botToken, userProfileService }),
      buildSearchKnowledgeBaseTool({ knowledgeBaseService, studioId }),
      buildListStudioScheduleTool({ groupService, trainingService }),
    ]
  }

  return [
    buildRunReadonlyQueryTool({ readonlyPool }),
    buildSearchKnowledgeBaseTool({ knowledgeBaseService, studioId }),
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
