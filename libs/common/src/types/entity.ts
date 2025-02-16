import { PASS, TRAINING_SCHEDULE, SUBSCRIBTION } from '../constants'

export type PassStatus = (typeof PASS.STATUS)[keyof typeof PASS.STATUS]
export type SubscribtionTier = (typeof SUBSCRIBTION.TIER)[keyof typeof SUBSCRIBTION.TIER]
export type SubscribtionStatus = (typeof SUBSCRIBTION.STATUS)[keyof typeof SUBSCRIBTION.STATUS]
export type TrainingScheduleStatus = (typeof TRAINING_SCHEDULE.STATUS)[keyof typeof TRAINING_SCHEDULE.STATUS]
export type TrainingScheduleType = (typeof TRAINING_SCHEDULE.TYPE)[keyof typeof TRAINING_SCHEDULE.TYPE]
