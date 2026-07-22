import { GroupService } from '@app/domain/group'
import { API, AuditLogEntity, AuditLogOperation } from '@app/libs'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

export function buildDeassignGroupStaffMemberTool(deps: { groupService: GroupService }): AiToolDefinition {
  const { groupService } = deps

  return {
    name: 'deassign_group_staff_member',
    description:
      "Remove a group's regular trainer, leaving it without a default trainer until a new one is assigned. Always resolve the exact groupId (e.g. via run_readonly_query) before calling this.",
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'integer', description: 'The group id.' },
      },
      required: ['groupId'],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.CRITICAL,
    describeConfirmation: async (input: { groupId: number }) => {
      const group = await groupService.getGroupById(input.groupId)
      const currentName = group.trainer?.userProfile?.fullName
      const who = currentName ? `тренера ${currentName}` : 'тренера'
      return `⚠️ Зняти ${who} з групи "${group.name}"? Група залишиться без призначеного тренера.`
    },
    successMessage: '✅ Тренера групи знято.',
    execute: async (_actor, input: { groupId: number }) => {
      // manageGroupStaffMember resolves staffMemberId via findStaffMemberByCondition even for
      // DEASSIGN and throws NotFoundException if it can't — so it always needs the id of the
      // trainer currently assigned, not an empty/placeholder value. Derived here from groupId
      // rather than asked of the model, since it's fully determined by groupId anyway.
      const group = await groupService.getGroupById(input.groupId)
      const currentTrainerUserId = group.trainer?.userProfile?.id

      if (!currentTrainerUserId) {
        return { result: { groupId: input.groupId, deassigned: true, alreadyUnassigned: true } }
      }

      const updatedGroup = await groupService.manageGroupStaffMember(input.groupId, currentTrainerUserId, API.GROUP_ACTION.DEASSIGN)

      return {
        result: { groupId: input.groupId, deassigned: true },
        logOperations: [
          {
            entity: AuditLogEntity.GROUP,
            entityId: String(updatedGroup?.id ?? input.groupId),
            operation: AuditLogOperation.UPDATE,
            payload: { staffMemberId: null },
            timestamp: new Date().toISOString(),
            metadata: { serviceName: GroupService.name, methodName: 'manageGroupStaffMember' },
          },
        ],
      }
    },
  }
}
