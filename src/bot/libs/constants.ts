export const PASS_CONFIG = {
  DURATION_IN_DAYS: 30,
}

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
  STAFF: {
    GROUP: {
      MENU: 'grp.menu.st',
      TRAININGS: 'grp.trng.st',
      TRAININGS_SELECT: 'grp.trng.sel.st',
      BACK_TO_TRAININGS_SELECT: 'grp.trng.sel.back.st',
      SELECT: 'grp.sel.st',
      BACK_TO_SELECT: 'grp.sel.back.st',
    },
    TRAINING: {
      SIGNUPS: 'trng.sup.st',
      SELECT: 'trng.sel.st',
      CANCEL: 'trng.cancel.st',
      ACTIVATE: 'trng.activ.st',
      BACK_TO_MANAGE: 'trng.mng.back.st',
    },
    USER: {
      VERIFY_YES: 'usr.yver.st',
      VERIFY_NO: 'usr.nver.st',
      BLOCK: 'usr.block.st',
    },
  },
  CLIENT: {
    TRAINING: {
      SELECT: 'trng.sel.cl',
    },
    GROUP: {
      SELECT: 'grp.sel.cl',
    },
  },
  SCENES: {
    VERIFY_CLIENT: {
      PASS_TEMPLATE_PREVIEW: 'sc.vercl.pt.prvw',
      PASS_TEMPLATE_SELECT: 'c.vercl.pt.sel',
    },
  },
} as const
