
export const SCENES = {
  REGISTER: 'register',
} as const

export const CALLBACK_DATA = {
  DISABLED: '_disabled_',
  PAGINATION_KEY: '_pagination_',
  ITEM_KEY: '_item_',
  VERIFY_USER: '_verify_'
} as const;

export const CALLBACK_PREFIX = {
  VERIFY_USER: '[verify_user]',
  CLIENT_GROUP_SELECT: '[client_group_select]',
} as const