import { BotContext } from '../bot.context'
import { MESSAGES_SCENE } from '../static/messages'
import { BotHelper } from './bot.helper'
import { KeyboardHelper } from './keyboard.helper'
import { UserHelper } from './user.helper'

export class SceneHelper<T extends Record<string, any>> {
  constructor() {}

  setState(ctx: BotContext, update: Partial<T>) {
    ctx.scene.state = {
      ...ctx.scene.state,
      ...update,
    } as T
  }

  getStateAll(ctx: BotContext): T {
    return ctx.scene.state as T
  }

  getState<K extends keyof T>(ctx: BotContext, key: K): Pick<T, K>
  getState<K extends keyof T>(ctx: BotContext, keys: K[]): Pick<T, K>
  getState<K extends keyof T>(ctx: BotContext): T
  getState<K extends keyof T>(ctx: BotContext, key?: K | K[]) {
    const scene_state = ctx.scene.state as T

    if (Array.isArray(key)) {
      return key.reduce(
        (acc, k) => {
          acc[k] = scene_state[k]
          return acc
        },
        {} as Pick<T, K>,
      )
    }
    if (key !== undefined) {
      return { [key]: scene_state[key] } as Pick<T, K>
    }
    return scene_state
  }

  async handleAdminSceneError(ctx: BotContext, error: any, maintainerChatId: string) {
    await BotHelper.safeSendMessage(
      ctx.telegram,
      maintainerChatId,
      `Error: ${error?.message}\n\nUpdate: ${JSON.stringify(ctx.update)}`,
    )
    const user = UserHelper.getUser(ctx)
    const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(user.role)
    await ctx.replyWithHTML(
      `❌ Виникла помилка, ми вже повіломлені про неї. Спробуйте ще раз або зверніться до адміністратора.`,
      keyboard,
    )
    return ctx.scene.leave()
  }

  async handleAdminSceneExit(ctx: BotContext, promptMessageId: number | number[], action?: Function) {
    if (Array.isArray(promptMessageId)) {
      ctx.deleteMessages(promptMessageId).catch(() => {})
    } else {
      ctx.deleteMessage(promptMessageId).catch(() => {})
    }

    const user = UserHelper.getUser(ctx)
    const keyboard = KeyboardHelper.getRoleBasedMainMenuKeyboard(user.role)
    await ctx.replyWithHTML(MESSAGES_SCENE.EDIT_ENTITIES.EXIT, keyboard)
    if (action) {
      await action()
    }
    return ctx.scene.leave()
  }
}
