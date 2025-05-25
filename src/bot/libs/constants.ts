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
  VERIFY_USER: '_verifyuser',
  REJECT_USER_VERIFY: '_rejectuserverify',
  BLOCK_USER: '_blockuser',
  CLIENT_GROUP_SELECT: '_groupselectclient',
  CLEINT_TRAINING_SELECT: '_trainingselectclient',
  VERIFY_SCENE_PASS_TEMPLATE_PREVIEW: '_verifyScene_ptpreview',
  VERIFY_SCENE_PASS_TEMPLATE_SELECT: '_verifyScene_ptselect',
} as const
