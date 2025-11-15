import { API, AuditLogActions, AuditLogEntity, AuditLogOperation, AuditLogTrigger, DATE_FORMAT } from 'src/libs/constants'
import { AutocompletableString } from './utility'
import { TrainingSignupSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'

export type TDateFormats = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT] | AutocompletableString

export type TCustomApiResponseStatus = (typeof API.RESPONSE)[keyof typeof API.RESPONSE]
export type TCustomApiResponse<T = Record<string, any>> = { status: TCustomApiResponseStatus; message: string; data?: T }

export interface TSalaryPayoutResult {
  groups: Record<
    string,
    {
      groupName: string
      trainings: Array<{
        date: string
        trainingSignups: (TrainingSignupSelectModel & {
          userProfile?: Pick<UserProfileSelectModel, 'firstName' | 'lastName' | 'fullName'> | null
        })[]
        payout: number
      }>
      groupPayout: number
      trainingCount: number
    }
  >
  statistics: TPayoutStatistics
  trainingIds: number[]
}

export type TPayoutStatistics = {
  totalSignups: number
  totalTrainings: number
  totalPayout: number
  averagePayoutPerTraining: number
}

export interface AuditLogPayload {
  action: AuditLogActions
  actionId: string
  actionResponseTimeMs: number | null
  telegramId?: string
  entity?: AuditLogEntity
  entityId?: string
  operation?: AuditLogOperation
  payload?: Record<string, any>
  trigger?: AuditLogTrigger
  metadata?: Record<string, any>
  timestamp?: string
  studioId?: string
}

export interface AuditLogServiceOperation {
  entityId: string
  entity: AuditLogEntity
  payload: Record<string, any>
  operation: AuditLogOperation
  timestamp: string
  metadata?: AuditLogOperationMetadata
}

export interface AuditLogServiceResponse {
  logOperations: AuditLogServiceOperation[]
}

export interface AuditLogOperationMetadata {
  serviceName?: string
  methodName?: string
  [key: string]: any
}
