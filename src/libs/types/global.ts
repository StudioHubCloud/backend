import { API, AuditLogActions, AuditLogOperation, AuditLogTrigger, DATE_FORMAT } from 'src/libs/constants'
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

export interface ILogActionOptions {
  captureOldValue?: boolean
  sensitive?: string[]
  includeResult?: boolean
}

export interface AuditLogPayload {
  // Required fields
  action: AuditLogActions
  entityName: string
  entityId: string
  operation: AuditLogOperation

  // Optional fields
  oldValue?: Record<string, any>
  newValue?: Record<string, any>
  trigger?: AuditLogTrigger
  metadata?: Record<string, any>

  // Context (will be enriched by service)
  serviceName?: string
  methodName?: string
  telegramId?: string
  userRole?: string
  studioId?: string

  // Performance
  executionStartTime?: number
}
