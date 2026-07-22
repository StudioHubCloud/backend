import { GroupService } from '@app/domain/group'
import { UserProfileService } from '@app/domain/user-profile'
import { API, AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildAssignGroupStaffMemberTool(deps: {
  groupService: GroupService
  userProfileService: UserProfileService
}): AiToolDefinition {
  const { groupService, userProfileService } = deps

  return {
    name: 'assign_group_staff_member',
    description:
      "Assign a group's regular trainer (its default trainer for every future training, unless a training has its own substitute). staffUserId is the trainer's user_profile id. Always resolve the exact groupId and staffUserId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'integer', description: 'The group id.' },
        staffUserId: { type: 'string', description: "The trainer's user_profile id." },
      },
      required: ['groupId', 'staffUserId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { groupId: number; staffUserId: string }) => {
      const group = await groupService.getGroupById(input.groupId)
      const incoming = await userProfileService.getUserProfileById(input.staffUserId)
      const currentName = group.trainer?.userProfile?.fullName
      const currentLine = currentName ? ` (замість ${currentName})` : ''
      return `⚠️ Призначити ${incoming.fullName} тренером групи "${group.name}"${currentLine}?`
    },
    successMessage: '✅ Тренера групи призначено.',
    execute: async (_actor, input: { groupId: number; staffUserId: string }) => {
      const group = await groupService.manageGroupStaffMember(input.groupId, input.staffUserId, API.GROUP_ACTION.ASSIGN)

      return {
        result: { groupId: input.groupId, staffUserId: input.staffUserId, assigned: true },
        logOperations: [
          {
            entity: AuditLogEntity.GROUP,
            entityId: String(group?.id ?? input.groupId),
            operation: AuditLogOperation.UPDATE,
            payload: { staffMemberId: group?.staffMemberId },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: GroupService.name, methodName: 'manageGroupStaffMember' },
          },
        ],
      }
    },
  }
}
