export enum PassStatusEnum {
  ACTIVE = 'active',
  REQUESTED = 'requested',
  EXPIRED = 'expired',
}

export enum SubscribtionTierEnum {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ELITE = 'elite',
}

export enum SubscribtionStatusEnum {
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
}

export enum TrainingSignupStatusEnum {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  ARCHIVED = 'archived',
}

export enum TrainingSignupTypeEnum {
  MAIN = 'main',
  RESERVE = 'reserve',
  TRIAL = 'trial',
  SPECIAL = 'special',
}

export enum UserProfileRoleEnum {
  ADMIN = 'admin',
  TRAINER = 'trainer',
  GUEST = 'guest',
  CLIENT = 'client',
  MAINTAINER = 'maintainer',
}

export enum UserProfileStatusEnum {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked',
  UNVERIFIED = 'unverified',
  VERIFICATION_REQUESTED = 'verification_requested',
}

export enum GroupStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum PassTemplateTypeEnum {
  GROUP = 'group',
  INDIVIDUAL = 'individual',
}

export enum PassTemplateStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum StudioPriceTypeEnum {
  TRIAL = 'trial',
  ONE_TIME_GROUP = 'one_time_group',
  ONE_TIME_INDIVIDUAL = 'one_time_individual',
  DUO = 'duo',
  TRIO = 'trio',
}

export enum PaymentStatusEnum {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethodEnum {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  ONLINE = 'online',
  OTHER = 'other',
}

export enum StudioPayoutRuleTypeEnum {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
  PER_SIGNUP = 'per_signup',
}

export enum PassActivationFileTypeEnum {
  PHOTO = 'photo',
  DOCUMENT = 'document',
}

export enum PassActivationRequestTypeEnum {
  PURCHASE = 'purchase',
  RENEW = 'renew',
}

export enum AuditLogOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum AuditLogActions {
  TRAINING_SIGNUP_CREATE = 'training_signup_create',
  TRAINING_SIGNUP_CANCEL = 'training_signup_cancel',
  TRAINING_SIGNUP_STATUS_CHANGE = 'training_signup_status_change',
}

export enum AuditLogTrigger {
  SCHEDULED_TASK = 'scheduled_task',
  ADMIN_ACTION = 'admin_action',
  CLIENT_ACTION = 'client_action',
  SYSTEM = 'system',
}

export enum AuditLogEntity {
  PAYMENT = 'payment',
  TRAINING_SIGNUP = 'training_signup',
  TRAINING = 'training',
  GROUP = 'group',
  PASS = 'pass',
  CLIENT = 'client',
  USER_PROFILE = 'user_profile',
}
