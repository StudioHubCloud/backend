export const APP = {
  DECORATOR_KEYS: {
    ROLE_KEY: 'role',
    IS_PUBLIC_KEY: 'isPublic',
  },
  PROVIDERS: {
    DATE_TIME_SERVICE: 'DATE_TIME_SERVICE',
  },
} as const

export const DATE_FORMAT = {
  DATE: 'yyyy-MM-dd',
} as const

export const ENVIRONMENTS = {
  DEV: 'development',
  PRODUCTION: 'production',
}
export const CACHE = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
} as const
