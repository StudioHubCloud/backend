import { pgEnum } from 'drizzle-orm/pg-core'
import * as ENUMS from '@app/libs/constants/enums'

export function enumToPgEnum<T extends Record<string, any>>(myEnum: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum).map((value: any) => `${value}`) as any
}

export const PassStatusPgEnum = pgEnum('pass_status_enum', enumToPgEnum(ENUMS.PassStatusEnum))
export const GroupStatusPgEnum = pgEnum('group_status_enum', enumToPgEnum(ENUMS.GroupStatusEnum))
export const SubscribtionTierPgEnum = pgEnum('subscribtion_tier_enum', enumToPgEnum(ENUMS.SubscribtionTierEnum))
export const SubscribtionStatusPgEnum = pgEnum('subscribtion_status_enum', enumToPgEnum(ENUMS.SubscribtionStatusEnum))
export const TrainingSignupStatusPgEnum = pgEnum('training_signup_status_enum', enumToPgEnum(ENUMS.TrainingSignupStatusEnum))
export const TrainingSignupTypePgEnum = pgEnum('training_signup_type_enum', enumToPgEnum(ENUMS.TrainingSignupTypeEnum))
export const UserProfileRolePgEnum = pgEnum('userprofile_role_enum', enumToPgEnum(ENUMS.UserProfileRoleEnum))
export const UserProfileStatusPgEnum = pgEnum('userprofile_status_enum', enumToPgEnum(ENUMS.UserProfileStatusEnum))
