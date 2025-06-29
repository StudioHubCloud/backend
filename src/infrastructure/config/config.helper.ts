import config from './environments'

export const getStaticConfig = () => {
  const env = config()
  return {
    timeZone: env.TIME_ZONE,
    studioId: env.STUDIO_ID,
    nodeEnv: env.NODE_ENV,
  }
}

export const STATIC_CONFIG = getStaticConfig()