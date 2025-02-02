import { PASS, SUBSCRIBTION } from '../constants'

export type PassStatus = (typeof PASS.STATUS)[keyof typeof PASS.STATUS]
export type SubscribtionTier = (typeof SUBSCRIBTION.TIER)[keyof typeof SUBSCRIBTION.TIER]
export type SubscribtionStatus = (typeof SUBSCRIBTION.STATUS)[keyof typeof SUBSCRIBTION.STATUS]
