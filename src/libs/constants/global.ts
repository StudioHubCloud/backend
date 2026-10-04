export const APP = {
  DECORATOR_KEYS: {
    ROLE_KEY: 'role',
    IS_PUBLIC_KEY: 'isPublic',
  },
  PROVIDERS: {
    DATE_TIME_PROVIDER: 'DATE_TIME_PROVIDER',
  },
} as const

export const DATE_FORMAT = {
  DATE_MAIN: 'yyyy-MM-dd',
  TIME_MAIN: 'HH:mm',
  DATE_INPUT: 'dd.MM.yyyy',
  DATE_NOTIFICATION: 'd MMMM',
  DB: 'yyyy-MM-dd HH:mm:ss',
  TRAINING_DISPLAY: 'EEEE, d MMMM, HH:mm',
} as const

export const TRAINING_CONFIG = {
  DURATION_MINUTES: 60, // group trainings and individual sessions alike (no per-training duration in the DB)
} as const

export const ENVIRONMENTS = {
  DEV: 'development',
  PRODUCTION: 'production',
}
export const CACHE = {
  DEFAULT_TTL: 5 * 60, // 5 minutes
  ENTITY_KEY_PREFIX: 'cache:', // reset() clears only keys under this prefix
} as const
export const BOT_SESSION = {
  KEY_PREFIX: 'session:', // outside CACHE.ENTITY_KEY_PREFIX, so cache reset() never clears sessions
  TTL: 7 * 24 * 60 * 60, // 7 days, refreshed on every update the user sends
} as const
