import { UserProfileRoleEnum, UserProfileStatusEnum } from '@app/libs'
import { AuthUserProfile, UserProfileWithClient } from '@app/bot/libs'
import { BotContext } from '../bot.context'
import type { DateTimeProvider } from '@app/infrastructure/providers'
import { StaffMemberSelectModel, TrainingSignupSelectModel, UserProfileSelectModel } from '@app/infrastructure/database'

export class UserHelper {
  static getUser(ctx: BotContext): AuthUserProfile {
    return ctx.store.user || ({} as AuthUserProfile)
  }

  static setUser(ctx: BotContext, user?: AuthUserProfile) {
    ctx.store.user = user ?? null
  }

  /**
   * Whom the client screens act for: the child picked in "Мої діти", otherwise the user. Roles, audit and the rules consent
   * stay on `getUser` (the person who taps).
   */
  static getActingUser(ctx: BotContext): AuthUserProfile {
    return ctx.store.actingUser ?? this.getUser(ctx)
  }

  static setActingUser(ctx: BotContext, child: AuthUserProfile | null) {
    ctx.store.actingUser = child
  }

  static isActingForChild(ctx: BotContext) {
    return !!ctx.store.actingUser
  }

  /** Age of the child a parent acts for (parents' rules texts); null when acting for self or no date of birth. */
  static getActingChildAge(ctx: BotContext, dateTimeProvider: Pick<DateTimeProvider, 'getAgeFromBirthday'>) {
    const child = ctx.store.actingUser
    return child?.dateOfBirth ? dateTimeProvider.getAgeFromBirthday(child.dateOfBirth) : null
  }

  /** A parent (a child approved or waiting): the profile button in the main menu. */
  static hasChildren(user: Pick<AuthUserProfile, 'children'> | null | undefined) {
    return !!user?.children?.some(
      ({ child }) => child.status === UserProfileStatusEnum.ACTIVE || child.status === UserProfileStatusEnum.VERIFICATION_REQUESTED,
    )
  }

  /** A parent can act for a child once the admin approved it (active, has a client row). */
  static canActFor(child: Pick<AuthUserProfile, 'status' | 'client'>) {
    return child.status === UserProfileStatusEnum.ACTIVE && !!child.client
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
    const result = lastName ? `${firstName} ${lastName}` : firstName
    return result?.trim() || 'Видалений клієнт'
  }

  static getDisplayName(user: UserProfileSelectModel | UserProfileWithClient | null): string {
    if (!user) return 'Невідомий користувач'

    const result = user.fullName || this.getFullName(user.firstName, user.lastName)
    return result.trim()
  }

  static getSignupDisplayName(signup: TrainingSignupSelectModel & { userProfile: UserProfileSelectModel | null }): string {
    if (!signup.userProfile) {
      return signup.fallbackUsername || 'Невідомий клієнт'
    }
    return this.getDisplayName(signup.userProfile)
  }

  static isArchivedProfile(userProfile: UserProfileSelectModel): boolean {
    return userProfile.status === UserProfileStatusEnum.ARCHIVED
  }

  static isStaffMember(user: UserProfileSelectModel & { staffMember: StaffMemberSelectModel | null }): boolean {
    return (
      (user.role === UserProfileRoleEnum.ADMIN ||
        user.role === UserProfileRoleEnum.TRAINER ||
        user.role === UserProfileRoleEnum.MAINTAINER) &&
      user.staffMember !== null
    )
  }

  /** The person the client screens act for (a parent's child or self) and whether they have any pass. */
  static hasPass(ctx: BotContext): [boolean, AuthUserProfile] {
    const user = this.getActingUser(ctx)
    const client = user.client
    const hasPass = !!client && client.pass.length > 0
    return [hasPass, user]
  }

  static checkHasPass(user: AuthUserProfile): boolean {
    const client = user.client
    return !!client && client.pass.length > 0
  }
}
