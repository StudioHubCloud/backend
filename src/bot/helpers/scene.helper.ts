import { BotContext } from '../bot.context'

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

  getState<K extends keyof T>(ctx: BotContext, key?: K | K[]) {
    const scene_state = ctx.scene.state as T

    if (Array.isArray(key)) {
      return key.reduce((acc, k) => {
        acc[k] = scene_state[k]
        return acc
      }, {} as T)
    }
    if (typeof key === 'string') {
      return { [key]: scene_state[key] } as unknown as Partial<T>
    }
    return scene_state
  }
}
