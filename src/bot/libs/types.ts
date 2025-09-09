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
import { EDIT_GROUP_SCENE_ACTIONS, EDIT_PASS_SCENE_ACTIONS } from './constants'

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

export type TEditGroupSceneAction = (typeof EDIT_GROUP_SCENE_ACTIONS)[keyof typeof EDIT_GROUP_SCENE_ACTIONS]
export type TEditPassSceneAction = (typeof EDIT_PASS_SCENE_ACTIONS)[keyof typeof EDIT_PASS_SCENE_ACTIONS]
