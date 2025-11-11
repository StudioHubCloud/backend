import {
  ClientSelectModel,
  GroupAgeRestrictionSelectModel,
  GroupSelectModel,
  GroupStyleSelectModel,
  UserProfileSelectModel,
  GroupAgeRestrictionExceptionSelectModel,
  TrainingSelectModel,
  GroupScheduleSelectModel,
  GroupStyleVariantSelectModel,
  TrainingSignupSelectModel,
  StaffMemberSelectModel,
} from '@app/infrastructure/database/models'
import { AuditLogActions, AuditLogTrigger, PassStatusEnum, UserProfileRoleEnum, AuditLogServiceOperation } from '@app/libs'
import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from '@telegraf/types'
import { BotContext } from '../bot.context'
import {
  CLIENT_STATUS_CHANGE_ACTIONS,
  EDIT_GROUP_SCENE_ACTIONS,
  EDIT_PASS_SCENE_ACTIONS,
  EDIT_USER_PROFILE_SCENE_ACTIONS,
} from './constants'

export type TBotStore = {
  user: AuthUserProfile | null
  audit: IAuditLogTelegramContext | null
}

export type AuthUserProfile = UserProfileSelectModel & {
  client: (ClientSelectModel & { pass: { id: string; status: PassStatusEnum; groupId: number | null }[] }) | null
}

export type UserProfileWithRoleRelations = UserProfileSelectModel & { client: ClientSelectModel | null } & {
  staffMember: StaffMemberSelectModel | null
}
export type UserProfileWithClient = UserProfileWithRoleRelations & { client: NonNullable<UserProfileWithRoleRelations['client']> }

export type TNextFunction = () => Promise<void>

export type TNormalizedOption = { label: string; value: string | number }
export type TPaginatedMenuRenderOptions = {
  shouldEdit?: boolean
  backButtonCallbackData?: string | null
  backButtonCallback?: (ctx: BotContext) => Promise<any> | void
  withExitButton?: boolean
  context?: Record<string, any>
}

export type TPaginatedMenuOptions = { page?: number; perPage?: number; prefix: string }

export interface TSceneNavigationExtras<T> {
  data: T
  role: UserProfileRoleEnum
}

export interface NavigationMapValues<T> {
  message: string | ((data: TSceneNavigationExtras<T>) => string)
  keyboard: TReplyMarkupKeyboard
  cursor: number
}

export interface NavigationMapEntries<T> {
  next?: NavigationMapValues<T>
  prev?: NavigationMapValues<T>
}

export interface IRoleNavigationMap<T> extends Partial<Record<UserProfileRoleEnum, NavigationMapEntries<T>>> {
  default?: NavigationMapEntries<T>
}

export interface ISceneNavigationMap<T> {
  [key: number]: IRoleNavigationMap<T>
}

export type TReplyMarkupKeyboard = { reply_markup: ReplyKeyboardMarkup }
export type TReplyInlineKeyboard = { reply_markup: InlineKeyboardMarkup }

export interface ISelectInlineMenuConfig<T> {
  callbackPrefix: string
  onItemSelect: (ctx: T, itemId: string, context?: Record<string, any>) => any
  promptMessage?: string | Function
  noOptionsMessage?: string | Function
}

export interface IRegisterSceneState {
  firstName: string
  lastName?: string
  telegramUsername?: string
  firstNameAlt?: string
  lastNameAlt?: string
  phone?: string
  date_of_birth?: string
}

export interface GetGroupByIdResponse extends GroupSelectModel {
  trainer: (StaffMemberSelectModel & { userProfile: UserProfileSelectModel | null }) | null
  groupStyle: GroupStyleSelectModel
  groupAgeRestrictions: GroupAgeRestrictionSelectModel | null
  groupAgeRestrictionExeptions?: GroupAgeRestrictionExceptionSelectModel[] | null
}

export interface GetTrainingByIdResponse extends TrainingSelectModel {
  trainer: (StaffMemberSelectModel & { userProfile: UserProfileSelectModel | null }) | null
  group: Pick<GroupSelectModel, 'status'>
  trainingSignups: (TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null })[]
  groupSchedule:
    | (GroupScheduleSelectModel & {
        groupStyleVariant: GroupStyleVariantSelectModel | null
      })
    | null
}

export interface GetTrainingSignupsByPassIdResponse extends TrainingSignupSelectModel {
  training: TrainingSelectModel | null
  group: GroupSelectModel | null
}

export interface TEditEntitySceneMetaData {
  // meta data
  isInitialRun: boolean
  promptMessageId: number
}

export interface IAuditLogTelegramContext {
  command?: string
  action: AuditLogActions
  actionId: string
  actionResponseTimeMs: number | null
  trigger: AuditLogTrigger
  telegramId: string
  operations: AuditLogServiceOperation[]
}

export type TEditGroupSceneAction = (typeof EDIT_GROUP_SCENE_ACTIONS)[keyof typeof EDIT_GROUP_SCENE_ACTIONS]
export type TEditPassSceneAction = (typeof EDIT_PASS_SCENE_ACTIONS)[keyof typeof EDIT_PASS_SCENE_ACTIONS]
export type TClientStatusChangeAction = (typeof CLIENT_STATUS_CHANGE_ACTIONS)[keyof typeof CLIENT_STATUS_CHANGE_ACTIONS]
export type TEditUserProfileSceneAction = (typeof EDIT_USER_PROFILE_SCENE_ACTIONS)[keyof typeof EDIT_USER_PROFILE_SCENE_ACTIONS]
