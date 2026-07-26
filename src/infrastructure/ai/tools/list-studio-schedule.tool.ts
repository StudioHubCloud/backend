import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { AI_RISK_TIER, AiToolDefinition } from '../ai.types'

// The client-facing counterpart to run_readonly_query: clients don't get raw SQL access (too much
// surface area — other clients' data, payments, staff info), just this narrow, safe read of what
// a prospective/existing client would reasonably want to see. Reuses the same service methods the
// existing (non-AI) client schedule flow uses, so the age-restriction filtering and "what's safe to
// show a client" boundary stay in one place rather than being re-derived here.
export function buildListStudioScheduleTool(deps: { groupService: GroupService; trainingService: TrainingService }): AiToolDefinition {
  const { groupService, trainingService } = deps

  return {
    name: 'list_studio_schedule',
    description:
      "List the studio's active groups (the classes/styles it offers), or the upcoming training dates for one specific group. " +
      'Call it with no groupId first to see what groups exist, then again with that group\'s id to see its upcoming trainings. ' +
      "Only returns groups the person you're talking to is age-eligible for.",
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'number',
          description: "Omit to list all active groups. Pass a specific group's id (from a prior call) to list its upcoming trainings instead.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    riskTier: AI_RISK_TIER.STANDARD,
    execute: async (actor, input: { groupId?: number }) => {
      if (input.groupId === undefined) {
        const groups = await groupService.getAllUserAgeResctictedActiveGroups({ userId: actor.id })
        return {
          result: {
            groups: groups.map((group) => ({
              id: group.id,
              name: group.name,
              style: group.groupStyle?.title,
              capacity: group.capacity,
            })),
          },
        }
      }

      const trainings = await trainingService.getTrainingListForManage({ groupId: input.groupId })
      return {
        result: {
          trainings: trainings.map((training) => ({ id: training.id, date: training.date, isCancelled: training.isCancelled })),
        },
      }
    },
  }
}
