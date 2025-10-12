export const PASS_CONFIG = {
  DEFAULT_DURATION_IN_DAYS: 30,
  ACTIVATION_GRACE_PERIOD: 7,
} as const

export const COMMON = {
  SIGNOUT_ALLOWED_HOURS_BEFORE_TRAINING: 6,
  INCOMING_TRAININGS_DAYS_RANGE: 7,
  TRAINING_MANAGE_SUBSTRACT_DAYS_THRESHOLD: 7,
} as const

export const SCENES = {
  REGISTER: 'register',
  VERIFY_CLIENT: 'verify_client',
  VERIFY_TRAINER: 'verify_trainer',
  SIGN_IN_CLIENT: 'sign_in_client',
  INITIATE_PAYOUT: 'initiate_payout',
  SPECIAL_SCHEDULE: 'special_schedule',
  EDIT_GROUP: 'edit_group',
  EDIT_PASS: 'edit_pass',
  EDIT_USER_PROFILE: 'edit_profile_name',
  PASS_PAYMENT: 'pass_payment',
} as const

export const CALLBACK_DATA = {
  DISABLED: '_disabled_',
  CLOSE_MENU: '__close_menu__',
  PAGINATION_KEY: 'pagination',
  ITEM_KEY: 'item',
  VERIFY_USER: 'verify',
} as const

export const CALLBACK_PREFIX = {
  STAFF: {
    GROUP: {
      MENU: 'g.m.st',
      TRAININGS: 'g.tr.st',
      TRAININGS_SELECT: 'g.tr.s.st',
      BACK_TO_TRAININGS_SELECT: 'g.tr.s.b.st',
      SELECT: 'g.s.st',
      BACK_TO_SELECT: 'g.s.b.st',
      BACK_TO_SELECTED_GROUP: 'g.s.b.s.st',
    },
    TRAINING: {
      SIGNUPS_ACTIVE: 'tr.sua.st',
      SIGNUPS_CANCELED: 'tr.suc.st',
      SIGN_IN: 'tr.si.st',
      CUSTOM_SIGN_IN: 'tr.csi.st',
      SIGN_OUT: 'tr.so.st',
      ASSIGN_SUBSTITUTE_LIST: 'tr.as.st',
      DEASSIGN_SUBSTITUTE_LIST: 'tr.des.st',
      ASSIGN_SUBSTITUTE_SELECT: 'tr.as.s.st',
      SELECT: 'tr.s.st',
      CANCEL: 'tr.c.st',
      ACTIVATE: 'tr.a.st',
      BACK_TO_MANAGE: 'tr.m.b.st',
      CLIENT_SIGNOUT_SELECT: 'tr.c.so.s.st',
      CLIENT_SIGNIN_SELECT: 'tr.c.si.s.st',
      BACK_TO_CLOSEST_TRAINING_LIST: 'tr.cl.s.b.st',
    },
    USER: {
      REQUEST_CLIENT_VERIFICATION: 'u.rc.st',
      ACTIVATE_PASS_REQUESTS: 'u.rp.st',
      VERIFY_YES: 'u.vy.st',
      VERIFY_WITHOUT_PASS: 'u.vw.st',
      PASS_PAYMENT_CONFIRM: 'u.pp.pay.c.st',
      PASS_PAYMENT_REJECT: 'u.pp.pay.r.st',
      VERIFY_NO: 'u.vn.st',
      BLOCK: 'u.b.st',
    },
    PAYOUT: {
      DETAILS: 'p.i.st',
      SUMMARY: 'p.d.st',
      INITIATE: 'p.init.st',
      CLIENT_INFO: 'p.i.cl',
      BACK_TO_STAFF_MANAGE: 'p.b.s.st.m',
      BACK_TO_STAFF_LIST: 'p.b.s.st.l',
    },
    MANAGE: {
      LIST: 'm.l.st',
      GROUPS_LIST: 'm.s.g.l.st',
      ADD_GROUP: 'm.a.g.st',
      ADD_GROUP_SELECT: 'm.a.g.s.st',
      REMOVE_GROUP: 'm.r.g.st',
      REMOVE_GROUP_SELECT: 'm.r.g.s.st',
      ASSIGN_GROUP: 'm.as.g.st',
      DEASSIGN_GROUP: 'm.de.g.st',
    },
  },
  CLIENT: {
    TRAINING: {
      SELECT: 'tr.s.cl',
      SIGN_OUT: 'tr.so.cl',
    },
    GROUP: {
      SELECT: 'g.s.cl',
      BACK_TO_SELECT: 'g.s.b.cl',
    },
    MANAGE: {
      MENU: 'm.m.cl',
      BACK_TO_MENU: 'm.m.b.cl',
      BACK_TO_CLIENT_LIST: 'm.m.b.cl.l',
      ARCHIVE: 'm.a.cl',
      UNARCHIVE: 'm.ua.cl',
      PROFILE: {
        EDIT: 'm.p.e.cl',
        EDIT_NAME: 'm.p.e.n.cl',
        EDIT_DATE_OF_BIRTH: 'm.p.e.dob.cl',
        EDIT_PHONE: 'm.p.e.ph.cl',
      },
      PASS: {
        MANAGE: 'm.p.m.cl',
        ACTIVATE: 'm.p.act.cl',
        EDIT_START_DATE: 'm.p.e.s.cl',
        EDIT_END_DATE: 'm.p.e.e.cl',
        EDIT_LENGTH: 'm.p.e.l.cl',
      },
    },
  },
  SCENES: {
    VERIFY_TRAINER: {
      GROUP_SELECT: 'sc.vertr.grp.sel',
    },
    PASS: {
      TYPE_SELECT: 'sc.pass.tp.sel',
      BACK_TO_TYPE_SELECT: 'sc.pass.tp.b.sel',
      TEMPLATE_DETAILS: 'sc.pass.tp.prvw',
      TEMPLATE_SELECT: 'sc.pass.tpl.sel',
      BACK_TO_LIST: 'sc.pass.tp.b.lst',
    },
    FILE: {
      BACK: 'sc.file.b',
      CONFIRM: 'sc.file.c',
      RESET: 'sc.file.d',
    },
  },
  COMMON: {
    AGREE_TO_RULES: 'cmn.agree.to.rules',
  },
} as const

export const EDIT_GROUP_SCENE_ACTIONS = {
  EDIT_LENGTH: 'edit_length',
  EDIT_START_DATE: 'edit_start_date',
  EDIT_END_DATE: 'edit_end_date',
} as const

export const EDIT_PASS_SCENE_ACTIONS = {
  EDIT_LENGTH: 'edit_length',
  EDIT_START_DATE: 'edit_start_date',
  EDIT_END_DATE: 'edit_end_date',
} as const

export const EDIT_USER_PROFILE_SCENE_ACTIONS = {
  EDIT_NAME: 'edit_name',
  EDIT_PHONE: 'edit_phone',
  EDIT_DATE_OF_BIRTH: 'edit_date_of_birth',
} as const

export const CLIENT_STATUS_CHANGE_ACTIONS = {
  ARCHIVE: 'archive',
  UNARCHIVE: 'unarchive',
  DELETE: 'delete',
  DELETE_AND_BLOCK: 'delete_and_block',
} as const
