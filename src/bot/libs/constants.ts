export const PASS_CONFIG = {
  DEFAULT_DURATION_IN_DAYS: 30,
  ACTIVATION_GRACE_PERIOD: 7,
} as const

export const COMMON = {
  SIGNOUT_ALLOWED_HOURS_BEFORE_TRAINING: 6,
  INCOMING_TRAININGS_DAYS_RANGE: 7,
  TRAINING_MANAGE_SUBSTRACT_DAYS_THRESHOLD: 7,
  // A training / individual session included in a trainer payout (paid, or prepared by the monthly cron) is final
  PAID_OUT_MESSAGE: '🔒 Заняття вже включене у виплату тренеру — зміни заборонені',
} as const

export const ERA_STUDIO_LOGO_320_DEV = 'AgACAgIAAxkBAAIqK2kVKoaeYgoI2mLw85CTcpzrJlaMAAK6DWsb9uCpSKX5LOSGkH-_AQADAgADbQADNgQ'
export const ERA_STUDIO_LOGO_320_PROD = 'AgACAgIAAxkBAAIY52kVLPuAEgAB6vbyVq8Pj6McmBfBNQACZQ9rG7V1qEj2uAQI0i_NpwEAAwIAA20AAzYE'

export const SCENES = {
  REGISTER: 'register',
  VERIFY_CLIENT: 'verify_client',
  VERIFY_TRAINER: 'verify_trainer',
  SIGN_IN_CLIENT: 'sign_in_client',
  SPECIAL_SCHEDULE: 'special_schedule',
  EDIT_GROUP: 'edit_group',
  EDIT_PASS: 'edit_pass',
  EDIT_USER_PROFILE: 'edit_profile_name',
  PASS_PAYMENT: 'pass_payment',
  PASS_OPEN: 'pass_open',
  ASK_AI: 'ask_ai',
  PERSONAL_TRAINING_REGISTER: 'personal_training_register',
  ONE_OFF_TRAINING_REGISTER: 'one_off_training_register',
  PERSONAL_TRAINING_NOTE_EDIT: 'personal_training_note_edit',
} as const

export const CALLBACK_DATA = {
  DISABLED: '_disabled_',
  CLOSE_MENU: '__close_menu__',
  PAGINATION_KEY: 'pagination',
  ITEM_KEY: 'item',
  VERIFY_USER: 'verify',
} as const

export const CALLBACK_PREFIX = {
  PICKER: {
    // PREVIOUS_STEP: the optional "⬅️ Назад" that leaves the picker (handle() returns { type: 'back' })
    // YEARS: a page of years (value: its first year), MONTHS: a year's months (value: yyyy); only with `yearRange`
    CALENDAR: { NAV: 'pk.cal.n', DAY: 'pk.cal.d', NOOP: 'pk.cal.x', PREVIOUS_STEP: 'pk.cal.p', YEARS: 'pk.cal.y', MONTHS: 'pk.cal.m' },
    TIME: { HOUR: 'pk.tm.h', MINUTE: 'pk.tm.m', BACK: 'pk.tm.b', PREVIOUS_STEP: 'pk.tm.p' },
  },
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
      SIGN_IN_PASS_SELECT: 'tr.ps.si.st',
      BACK_TO_CLOSEST_TRAINING_LIST: 'tr.cl.s.b.st',
    },
    USER: {
      REQUEST_CLIENT_VERIFICATION: 'u.rc.st',
      ACTIVATE_PASS_REQUESTS: 'u.rp.st',
      VERIFY_YES: 'u.vy.st',
      VERIFY_WITHOUT_PASS: 'u.vw.st',
      PASS_PAYMENT_CONFIRM: 'u.pp.pay.c.st',
      PASS_PAYMENT_REJECT: 'u.pp.pay.r.st',
      // Change the group of a requested FIXED pass: list (value: request id), pick (request id, group id), back
      PASS_PAYMENT_GROUP: 'u.pp.grp.st',
      PASS_PAYMENT_GROUP_SELECT: 'u.pp.grs.st',
      PASS_PAYMENT_GROUP_BACK: 'u.pp.grb.st',
      VERIFY_NO: 'u.vn.st',
      BLOCK: 'u.b.st',
    },
    PAYOUT: {
      DETAILS: 'p.i.st',
      DETAILS_BACK: 'p.i.st.b', // back from client info to the details (same screen as DETAILS)
      SUMMARY: 'p.d.st',
      INITIATE: 'p.init.st',
      CLIENT_INFO: 'p.i.cl',
      BACK_TO_STAFF_MANAGE: 'p.b.s.st.m',
      BACK_TO_STAFF_LIST: 'p.b.s.st.l',
      // Payouts the monthly cron prepared (status pending): the list, pay, cancel
      PENDING_LIST: 'p.pl', // value: 0
      APPROVE: 'p.ap', // value: payout id
      CANCEL_PENDING: 'p.cp', // value: payout id
      // Manual payout (admin): end of the period, then pay
      MANUAL_DATE: 'p.md', // value: staff user id, subvalue: period end dd.MM.yyyy
      MANUAL_PAY: 'p.mp', // value: staff user id, subvalue: period end dd.MM.yyyy
    },
    // Admin "Розклад студії": calendar → day → groups / individual sessions
    SCHEDULE: {
      CALENDAR: 'sch.cal', // value: yyyy-MM (month to show)
      DAY: 'sch.d', // value: yyyy-MM-dd
      GROUP: 'sch.g', // value: groupId, subvalue: yyyy-MM-dd (for "back to the day")
      PERSONAL: 'sch.p', // value: signup id
      PERSONAL_CANCEL: 'sch.pc', // value: signup id
      PERSONAL_NOTE: 'sch.pn', // value: signup id
    },
    // "⏱ Поточне заняття": confirm who came (group) / that a session took place (individual)
    CURRENT: {
      TRAINING: 'cur.t', // value: training id, subvalue: n = as a new message (opened from another menu)
      SESSION: 'cur.s', // value: personal training signup id, subvalue: n = as a new message
      ATTENDANCE: 'cur.a', // value: training signup id, subvalue: 1 = came, 0 = take back
      CONFIRM: 'cur.c', // value: personal training signup id, subvalue: c = completed, n = no-show, u = take back (+ s = from the schedule card)
      ADD_VISITOR: 'cur.v', // admin: a one-time visitor by name (SPECIAL_SCHEDULE scene); value: training id
    },
    PERSONAL_TRAINING: {
      REGISTER: 'pt.reg.st',
      CANCEL_LIST: 'pt.cl.st',
      CANCEL_SELECT: 'pt.cxl.st',
      UPCOMING: 'pt.up.st', // staff member's upcoming individual sessions
      ONE_OFF_REGISTER: 'pt.oo.reg.st',
      // "Персонал" → trainer: cancel any of the trainer's individual sessions (one-off or pass)
      STAFF_CANCEL_LIST: 'pt.st.cl.st',
      STAFF_CANCEL_SELECT: 'pt.st.cxl.st',
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
    PASS_RULES: 'p.rules.cl',
    PASS_SWITCH: 'p.sw.cl',
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
        VIEW: 'm.p.v.cl', // a chosen pass of a client with several active ones (value: passId)
        ADD_NEW: 'm.p.a.n.cl',
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
      CONFIRM_OPEN: 'sc.pass.op.cfm',
      GROUP_SELECT: 'sc.pass.grp.sel',
      GROUP_BACK: 'sc.pass.grp.b',
    },
    FILE: {
      BACK: 'sc.file.b',
      CONFIRM: 'sc.file.c',
      RESET: 'sc.file.d',
    },
    PERSONAL_TRAINING: {
      TRAINER_SELECT: 'sc.pt.tr.sel',
      PRICE_SELECT: 'sc.pt.pr.sel',
    },
  },
  COMMON: {
    AGREE_TO_RULES: 'cmn.agree.to.rules',
  },
  AI: {
    CONFIRM: 'ai.cfm',
    CANCEL: 'ai.cxl',
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
