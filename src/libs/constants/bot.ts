export const MENU_OPTIONS = {
  CLIENT: {
    MAIN: {},
  },
  BOT: {
    BACK: '⬅️ Назад',
    START: '🏠 Головне меню',
  },
} as const

export const SCENES = {
  GUEST: {
    EXAMPLE: 'guest-example',
  },
} as const

export const CALLBACK_DATA = {
  DISABLED: '_disabled_',
  PAGINATION_KEY: 'pagination',
  ITEM_KEY: 'item',
} as const;