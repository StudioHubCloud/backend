import { pgEnum } from 'drizzle-orm/pg-core'
import * as ENUMS from '@app/libs/constants/enums'

export function enumToPgEnum<T extends Record<string, any>>(myEnum: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum).map((value: any) => `${value}`) as any
}

export const PassStatusPgEnum = pgEnum('pass_status_enum', enumToPgEnum(ENUMS.PassStatusEnum))
export const SubscribtionTierPgEnum = pgEnum('subscribtion_tier_enum', enumToPgEnum(ENUMS.SubscribtionTierEnum))
export const SubscribtionStatusPgEnum = pgEnum('subscribtion_status_enum', enumToPgEnum(ENUMS.SubscribtionStatusEnum))
export const TrainingStatusPgEnum = pgEnum('training_status_enum', enumToPgEnum(ENUMS.TrainingStatusEnum))
export const TrainingTypePgEnum = pgEnum('training_type_enum', enumToPgEnum(ENUMS.TrainingTypeEnum))
export const UserProfileRolePgEnum = pgEnum('userprofile_role_enum', enumToPgEnum(ENUMS.UserProfileRoleEnum))
export const UserProfileStatusPgEnum = pgEnum('userprofile_status_enum', enumToPgEnum(ENUMS.UserProfileStatusEnum))
