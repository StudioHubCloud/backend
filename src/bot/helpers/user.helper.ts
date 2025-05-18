import { AuthUserProfile, UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { BotContext } from '../bot.context'

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
    return user.role === UserProfileRoleEnum.ADMIN
  }

  static isClientRole(role: UserProfileRoleEnum) {
    return role === UserProfileRoleEnum.CLIENT
  }

  static isTrainerRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.TRAINER
  }

  static isStaffMemberRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.ADMIN || user.role === UserProfileRoleEnum.TRAINER
  }

  static isGuestRole(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.role === UserProfileRoleEnum.GUEST
  }

  static isUnverifiedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.UNVERIVIED
  }

  static needVerification(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.UNVERIVIED || user.status === UserProfileStatusEnum.VERIFICATION_REQUESTED
  }

  static isBlockedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.BLOCKED
  }

  static isVerificatonRequestedStatus(ctx: BotContext) {
    const user = this.getUser(ctx)
    return user.status === UserProfileStatusEnum.VERIFICATION_REQUESTED
  }
}
