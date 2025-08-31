export const PASS_CONFIG = {
  DEFAULT_DURATION_IN_DAYS: 30,
  ACTIVATION_GRACE_PERIOD: 7,
} as const

export const COMMON = {
  SIGNOUT_ALLOWED_HOURS_BEFORE_TRAINING: 6,
} as const

export const SCENES = {
  REGISTER: 'register',
  VERIFY_CLIENT: 'verify_client',
  VERIFY_TRAINER: 'verify_trainer',
  SIGN_IN_CLIENT: 'sign_in_client'
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
      SIGNUPS_ACTIVE: 'trng.supa.st',
      SIGNUPS_CANCELED: 'trng.sgnc.st',
      SIGN_IN: 'trng.sgn.st',
      SIGN_OUT: 'trng.sgo.st',
      SELECT: 'trng.sel.st',
      CANCEL: 'trng.cancel.st',
      ACTIVATE: 'trng.activ.st',
      BACK_TO_MANAGE: 'trng.mng.back.st',
      CLIENT_SIGNOUT_SELECT: 'trng.cl.sgo.sel.st',
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
    VERIFY_TRAINER: {
      GROUP_SELECT: 'sc.vertr.grp.sel',
    },
  },
  COMMON: {
    AGREE_TO_RULES: 'cmn.agree.to.rules',
  },
} as const
