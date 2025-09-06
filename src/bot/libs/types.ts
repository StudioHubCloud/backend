import {
  ClientSelectModel,
  GroupAgeRestrictionSelectModel,
  GroupSelectModel,
  GroupStyleSelectModel,
  StudioSelectModel,
  UserProfileSelectModel,
  GroupAgeRestrictionExceptionSelectModel,
  TrainingSelectModel,
  GroupScheduleSelectModel,
  GroupStyleVariantSelectModel,
  TrainingSignupSelectModel,
} from '@app/infrastructure/database/models'
import { PassStatusEnum, UserProfileRoleEnum } from '@app/libs'
import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from '@telegraf/types'
import { BotContext } from '../bot.context'

export type TBotStore = {
  user: AuthUserProfile | null
  studio: StudioSelectModel | null
}

export type AuthUserProfile = UserProfileSelectModel & {
  client: (ClientSelectModel & { pass: { id: string; status: PassStatusEnum; groupId: number | null }[] }) | null
}

export type TNextFunction = () => Promise<void>

export type TNormalizedOption = { label: string; value: string | number }
export type TPaginatedMenuRenderOptions = {
  shouldEdit?: boolean
  backButtonCallbackData?: string | null
  backButtonCallback?: (ctx: BotContext) => Promise<any> | void
  context?: Record<string, any>
}

export type TPaginatedMenuOptions = { page?: number; perPage?: number; prefix: string }

export interface TSceneNavigationExtras {
  data: Record<string, unknown>
  role: UserProfileRoleEnum
}

export interface NavigationMapValues {
  message: string | ((data: TSceneNavigationExtras) => string)
  keyboard: TReplyMarkupKeyboard
  cursor: number
}

export interface NavigationMapEntries {
  next?: NavigationMapValues
  prev?: NavigationMapValues
}

export interface IRoleNavigationMap extends Partial<Record<UserProfileRoleEnum, NavigationMapEntries>> {
  default: NavigationMapEntries
}

export interface ISceneNavigationMap {
  [key: number]: IRoleNavigationMap
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
  firstNameAlt?: string
  lastNameAlt?: string
  phone?: string
  date_of_birth?: string
}

export interface GetGroupByIdResponse extends GroupSelectModel {
  groupStyle: GroupStyleSelectModel
  groupAgeRestrictions: GroupAgeRestrictionSelectModel | null
  groupAgeRestrictionExeptions?: GroupAgeRestrictionExceptionSelectModel[] | null
}

export interface GetTrainingByIdResponse extends TrainingSelectModel {
  group: Pick<GroupSelectModel, 'status'>
  trainingSignups: (TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null })[]
  groupSchedule:
    | (GroupScheduleSelectModel & {
        groupStyleVariant: GroupStyleVariantSelectModel | null
      })
    | null
}
