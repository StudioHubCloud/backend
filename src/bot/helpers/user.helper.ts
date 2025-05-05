import { UserProfileRoleEnum } from '@app/libs'
import { BotContext } from '../bot.context'
import { UserProfileSelectModel } from '@app/infrastructure/database'

export class UserHelper {

  static getUser(ctx: BotContext): UserProfileSelectModel {
    return ctx.store.user || {} as UserProfileSelectModel
  }

  static getUserUnsafe(ctx: BotContext) {
    return ctx.store.user 
  }

  static getUserRole(ctx: BotContext) {
    const user = ctx.store.user
    if (!user) return null
    return user.role
  }

  static isUserAdmin(ctx: BotContext) {
    const user = ctx.store.user
    if (!user) return false
    return user.role === UserProfileRoleEnum.ADMIN
  }

  static isUserClient(ctx: BotContext) {
    const user = ctx.store.user
    if (!user) return false
    return user.role === UserProfileRoleEnum.ADMIN
  }
  
  static isUserTrainer(ctx: BotContext) {
    const user = ctx.store.user
    if (!user) return false
    return user.role === UserProfileRoleEnum.TRAINER
  }

  static isUserStaffMember(ctx: BotContext) {
    const user = ctx.store.user
    if (!user) return false
    return user.role === UserProfileRoleEnum.ADMIN || user.role === UserProfileRoleEnum.TRAINER
  }

  static isUserGuest(ctx: BotContext) {
    const user = ctx.store.user
    if (!user) return false
    return user.role === UserProfileRoleEnum.GUEST
  }
}
