import { Pool } from 'pg'
import { GroupService } from '@app/domain/group'
import { TrainingService } from '@app/domain/training'
import { AiToolDefinition } from '../ai.types'
import { buildRunReadonlyQueryTool } from './run-readonly-query.tool'
import { buildCancelTrainingTool } from './cancel-training.tool'
import { buildActivateTrainingTool } from './activate-training.tool'
import { buildNotifyMaintainerTool } from './notify-maintainer.tool'

export function buildAdminTools(deps: {
  groupService: GroupService
  trainingService: TrainingService
  readonlyPool: Pool
  botToken: string
  maintainerChatId: string
}): AiToolDefinition[] {
  const { groupService, trainingService, readonlyPool, botToken, maintainerChatId } = deps

  return [
    buildRunReadonlyQueryTool({ readonlyPool }),
    buildCancelTrainingTool({ groupService, trainingService }),
    buildActivateTrainingTool({ groupService, trainingService }),
    buildNotifyMaintainerTool({ botToken, maintainerChatId }),
  ]
}

export { RUN_READONLY_QUERY_STATIC_DESCRIPTION } from './run-readonly-query.tool'
export { getSchemaSummary } from './schema-summary.provider'
