import { UserProfileStatusEnum } from '@app/libs'

export const SCENES = {
  REGISTER: 'register',
  VERIFY_CLIENT: 'verify_client',
  VERIFY_TRAINER: 'verify_trainer',
} as const

export const CALLBACK_DATA = {
  DISABLED: '_disabled_',
  PAGINATION_KEY: 'pagination',
  ITEM_KEY: 'item',
  VERIFY_USER: 'verify',
} as const

export const CALLBACK_PREFIX = {
  VERIFY_USER: 'verifyuser',
  REJECT_USER_VERIFY: 'rejectuserverify',
  BLOCK_USER: 'blockuser',
  CLIENT_GROUP_SELECT: 'groupselectclient',
  CLEINT_TRAINING_SELECT: 'trainingselectclient',
} as const
