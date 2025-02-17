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

export const PASS = {
  STATUS: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    EXPIRED: 'expired',
  },
} as const

export const TRAINING_SCHEDULE = {
  STATUS: {
    ACTIVE: 'active',
    CANCELED: 'canceled',
    COMPLETED: 'completed',
  },
  TYPE: {
    MAIN: 'main',
    RESERVE: 'reserve',
    PERSONAL: 'personal',
  },
} as const
