import { StudioSelectModel, UserProfileSelectModel } from '@app/infrastructure/database/models'
import { ReplyKeyboardMarkup } from '@telegraf/types'

export type TBotStore = {
  user: UserProfileSelectModel | null
  studio: StudioSelectModel | null
}

export type TNextFunction = () => Promise<void>

interface NavigationMapEntry {
  message: string;
  nextCursor: number; 
}

export interface ISceneNavigationMap {
  [key: string]: NavigationMapEntry;
}

export type TReplyMarkupKeyboard = { reply_markup: ReplyKeyboardMarkup }