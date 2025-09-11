import { BotContext } from '../bot.context'
import { AdminKeyboards } from '../keyboard/storage'
import { MESSAGES_SCENE } from '../static/messages'

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

  async handleAdminSceneError(ctx: BotContext, error: any, mainTainerChatId: string) {
    await ctx.telegram.sendMessage(mainTainerChatId, `Error: ${error?.message}\n\nUpdate: ${JSON.stringify(ctx.update)}`)
    await ctx.replyWithHTML(
      `❌ Виникла помилка, ми вже повіломлені про неї. Спробуйте ще раз або зверніться до адміністратора.`,
      AdminKeyboards.mainMenu(),
    )
    return ctx.scene.leave()
  }

  async handleAdminSceneExit(ctx: BotContext, promptMessageId: number, action?: Function) {
    ctx.deleteMessage(promptMessageId).catch(() => {})
    await ctx.replyWithHTML(MESSAGES_SCENE.EDIT_ENTITIES.EXIT, AdminKeyboards.mainMenu())
    if (action) {
      await action()
    }
    return ctx.scene.leave()
  }
}
