export const USER_PROFILE = {
  ROLE: {
    ADMIN: 'admin',
    STAFFMEMBER: 'staffMember',
    GUEST: 'guest',
    CLIENT: 'client',
  },
  STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    NOT_VERIFIED: 'not_verified',
    BLOCKED: 'blocked',
  },
  DEFAULTS: {
    COUNTRY_CODE: 'UA',
    STATUS: 'not_verified',
  },
} as const

export const SUBSCRIBTION = {
  TIER: {
    BASIC: 'basic',
    PROFESSIONAL: 'professional',
    ELITE: 'elite',
  },
  STATUS: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    EXPIRED: 'expired',
    CANCELED: 'canceled',
  },
} as const

export const STAFF_MEMBERS = {
  ROLE: {
    ADMIN: 'admin',
    TRAINER: 'trainer',
    MANAGER: 'manager',
  },
} as const

export const SESSION_DAYS = {
  0: ['Неділя', 'Нд'],
  1: ['Понеділок', 'Пн'],
  2: ['Вівторок', 'Вт'],
  3: ['Середа', 'Ср'],
  4: ['Четверг', 'Чт'],
  5: ["П'ятниця", 'Пт'],
  6: ['Субота', 'Сб'],
} as const

export const PASS = {
  STATUS: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    EXPIRED: 'expired',
  },
} as const
