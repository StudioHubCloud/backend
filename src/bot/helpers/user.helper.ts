import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { AuthUserProfile } from '@app/bot/libs'
import { BotContext } from '../bot.context'
import { StaffMemberSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'

export class UserHelper {
  static getUser(ctx: BotContext): AuthUserProfile {
    return ctx.store.user || ({} as AuthUserProfile)
  }

  static setUser(ctx: BotContext, user?: AuthUserProfile) {
    ctx.store.user = user ?? null
  }

  static getUserUnsafe(ctx: BotContext) {
    return ctx.store.user
  }

  static getUserRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role
  }

  static isAdminRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.ADMIN || user.role === UserProfileRoleEnum.MAINTAINER
  }

  static isClientRole(role: UserProfileRoleEnum) {
    return role === UserProfileRoleEnum.CLIENT
  }

  static isTrainerRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.TRAINER
  }

  static isMaintainerRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.MAINTAINER
  }

  static isStaffMemberRole(ctx: BotContext, userPassed?: UserProfileSelectModel) {
    const user = userPassed ?? this.getUser(ctx)
    return (
      user.role === UserProfileRoleEnum.ADMIN ||
      user.role === UserProfileRoleEnum.TRAINER ||
      user.role === UserProfileRoleEnum.MAINTAINER
    )
  }

  static isGuestRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.GUEST
  }

  static isUnverifiedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.UNVERIFIED
  }

  static needVerification(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.UNVERIFIED || user.status === UserProfileStatusEnum.VERIFICATION_REQUESTED
  }

  static isBlockedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.BLOCKED
  }

  static isArchivedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.ARCHIVED
  }

  static isVerificatonRequestedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.VERIFICATION_REQUESTED
  }

  static getFullName(firstName: string, lastName?: string | null): string {
    return lastName ? `${firstName} ${lastName}` : firstName
  }

  static getFullNameFromProfile(user: UserProfileSelectModel): string {
    return this.getFullName(user.firstName, user.lastName)
  }

  static isArchivedProfile(userProfile: UserProfileSelectModel): boolean {
    return userProfile.status === UserProfileStatusEnum.ARCHIVED
  }

  static isStaffMember(user: UserProfileSelectModel & { staffMember: StaffMemberSelectModel | null }): boolean {
    return (user.role === UserProfileRoleEnum.ADMIN || user.role === UserProfileRoleEnum.TRAINER || user.role === UserProfileRoleEnum.MAINTAINER) && user.staffMember !== null
  }
}
