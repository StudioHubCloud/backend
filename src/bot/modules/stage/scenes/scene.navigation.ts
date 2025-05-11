import { BotContext } from '@app/bot/bot.context'
import {
  NavigationMapValues,
  NavigationMapEntries,
  IRoleNavigationMap,
  UserProfileRoleEnum,
  TSceneNavigationExtras,
} from '@app/libs'
import { WizardContextWizard } from 'telegraf/typings/scenes'


export class SceneNavigation<T = IRoleNavigationMap, V = NavigationMapEntries> {

  private readonly navigationMap: T

  constructor(navMap: T, ) {
    this.navigationMap = navMap
  }

  getNavigation(role: UserProfileRoleEnum, cursor: number): V { //remove navigationMap  but add cursor
    const currentStep = this.navigationMap[cursor]
    return currentStep[role] || currentStep['default']
  }

  async handleBack(
    ctx: BotContext,
    prev?: NavigationMapValues,
    data?: TSceneNavigationExtras,
  ): Promise<WizardContextWizard<BotContext>> {
    let message = prev?.message
    if (typeof message === 'function') {
      message = message(data || ({} as TSceneNavigationExtras))
    }

    await ctx.replyWithHTML(message ?? 'No prev', ...(prev?.keyboard ? [prev.keyboard] : []))
    return ctx.wizard.selectStep(prev?.cursor || 0)
  }

  async handleNext(
    ctx: BotContext,
    next?: NavigationMapValues,
    data?: TSceneNavigationExtras,
  ): Promise<WizardContextWizard<BotContext>> {
    let message = next?.message
    if (typeof message === 'function') {
      message = message(data || ({} as TSceneNavigationExtras))
    }
    await ctx.replyWithHTML(message ?? 'No next', ...(next?.keyboard ? [next.keyboard] : []))
    return ctx.wizard.selectStep(next?.cursor || 0)
  }
}
