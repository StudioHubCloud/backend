import { ClientSelectModel, StudioSelectModel, UserProfileSelectModel } from '@app/infrastructure/database/models'
import { UserProfileRoleEnum } from '@app/libs'
import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from '@telegraf/types'

export type TBotStore = {
  user: AuthUserProfile | null
  studio: StudioSelectModel | null
}

export type AuthUserProfile = UserProfileSelectModel & {
  client: (ClientSelectModel & { pass: { id: string; groupId: string | null } | null }) | null
}

export type TNextFunction = () => Promise<void>

export type TNormalizedOption = { label: string; value: string }

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
  onItemSelect: (ctx: T, itemId: string) => any
  promptMessage?: string
  noOptionsMessage?: string
}

export interface IRegisterSceneState {
  firstName: string
  lastName?: string
  phone?: string
  date_of_birth?: string
}

