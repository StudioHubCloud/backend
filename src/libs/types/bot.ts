import { StudioSelectModel, UserProfileSelectModel } from '@app/infrastructure/database/models'

export type TBotStore = {
  user: UserProfileSelectModel | null
  studio: StudioSelectModel | null
}

export type TNextFunction = () => Promise<void>
