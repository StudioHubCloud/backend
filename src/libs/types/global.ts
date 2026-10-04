import { API, AuditLogActions, AuditLogEntity, AuditLogOperation, AuditLogTrigger, DATE_FORMAT } from '@app/libs/constants'
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
        // Confirmed attendees: the trainer is paid for them
        trainingSignups: (TrainingSignupSelectModel & {
          userProfile?: Pick<UserProfileSelectModel, 'firstName' | 'lastName' | 'fullName'> | null
        })[]
        signupCount: number // everyone signed up (active); trainingSignups holds only the confirmed ones
        payout: number
      }>
      groupPayout: number
      trainingCount: number
    }
  >
  personalTrainings: Array<{
    date: string
    title: string // one-off price name (e.g. "Дуо") or the pass template name
    participants: string // one-off participants note or the client's name
    isNote: boolean // participants is a one-off's free-text note (names, wishes, anything)
    isNoShow: boolean // confirmed as a no-show: closed by the payout with 0
    isUnconfirmed: boolean // nobody confirmed it: closed by the payout with 0
    price: number
    payout: number
  }>
  statistics: TPayoutStatistics
  trainingIds: number[]
  personalTrainingIds: string[]
}

export type TPayoutStatistics = {
  totalSignups: number // confirmed attendees of group trainings
  totalTrainings: number // group trainings
  groupPayout: number
  averagePayoutPerTraining: number // group trainings only
  personalTrainingCount: number // completed (paid) individual sessions, no-shows not included
  personalNoShowCount?: number // confirmed no-shows, closed with 0 (optional: older cached results / scene states)
  unmarkedTrainingCount?: number // group trainings with signups but nobody confirmed: closed with 0
  pendingPersonalCount?: number // past individual sessions nobody confirmed: closed with 0
  averageSignups?: number // confirmed people per group training, 1 decimal
  bonusThreshold?: number // the bonus rule's average (e.g. 10); undefined when the studio has no bonus rule
  bonus?: number // the bonus paid in this payout (0 when the average is below the threshold)
  personalPayoutPercentage: number // share of an individual session's price
  personalPayout: number
  totalPayout: number
}

export interface AuditLogPayload {
  action: AuditLogActions
  actionId: string
  actionResponseTimeMs: number | null
  telegramId?: string | null
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
