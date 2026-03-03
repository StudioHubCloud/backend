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
export const PassTemplateTypePgEnum = pgEnum('pass_template_type_enum', enumToPgEnum(ENUMS.PassTemplateTypeEnum))
export const PassTemplateStatusPgEnum = pgEnum('pass_template_status_enum', enumToPgEnum(ENUMS.PassTemplateStatusEnum))
export const StudioPriceTypePgEnum = pgEnum('studio_price_type_enum', enumToPgEnum(ENUMS.StudioPriceTypeEnum))
export const PaymentStatusPgEnum = pgEnum('payment_status_enum', enumToPgEnum(ENUMS.PaymentStatusEnum))
export const PaymentMethodPgEnum = pgEnum('payment_method_enum', enumToPgEnum(ENUMS.PaymentMethodEnum))
export const StudioPayoutRuleTypePgEnum = pgEnum('studio_payout_rule_type_enum', enumToPgEnum(ENUMS.StudioPayoutRuleTypeEnum))
export const FileTypePgEnum = pgEnum('pass_activation_file_type_enum', enumToPgEnum(ENUMS.FileTypeEnum))
export const PassActivationRequestTypePgEnum = pgEnum(
  'pass_activation_request_type_enum',
  enumToPgEnum(ENUMS.PassActivationRequestTypeEnum),
)
export const AuditLogOperationPgEnum = pgEnum('audit_log_operation_enum', enumToPgEnum(ENUMS.AuditLogOperation))
export const AuditLogTriggerPgEnum = pgEnum('audit_log_trigger_enum', enumToPgEnum(ENUMS.AuditLogTrigger))
export const AuditLogActionsPgEnum = pgEnum('audit_log_actions_enum', enumToPgEnum(ENUMS.AuditLogActions))
export const AuditLogEntityPgEnum = pgEnum('audit_log_entity_enum', enumToPgEnum(ENUMS.AuditLogEntity))
