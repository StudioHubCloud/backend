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

export const ENVIRONMENTS = {
  DEV: 'development',
  PRODUCTION: 'production',
}
export const CACHE = {
  DEFAULT_TTL: 5 * 60, // 5 minutes
} as const
