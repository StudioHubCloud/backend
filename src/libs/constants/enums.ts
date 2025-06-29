export enum PassStatusEnum {
  ACTIVE = 'active',
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
}

export enum UserProfileRoleEnum {
  ADMIN = 'admin',
  TRAINER = 'trainer',
  GUEST = 'guest',
  CLIENT = 'client',
}

export enum UserProfileStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  UNVERIVIED = 'unverified',
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

export enum StudioPriceTypeEnum {
  TRIAL = 'trial',
  ONE_TIME_GROUP = 'one_time_group',
  ONE_TIME_INDIVIDUAL = 'one_time_individual',
  DUO = 'duo',
  TRIO= 'trio',
}