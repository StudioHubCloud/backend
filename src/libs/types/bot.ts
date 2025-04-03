import { BusinessSelectModel, UserProfileSelectModel } from '@app/infrastructure/database/models'

export type TBotStore = {
  user: UserProfileSelectModel | null
  business: BusinessSelectModel | null
}
