import { BotContext } from '../bot.context'

export class SceneHelper<T extends Record<string, any>> {
  constructor() {}

  setState(ctx: BotContext, update: Partial<T>) {
    ctx.scene.state = {
      ...ctx.scene.state,
      ...update,
    } as T
  }

  getState<K extends keyof T>(ctx: BotContext, key: K | K[]) {
    const scene_state = (ctx.scene.state || {} ) as T

    if(!key) {
      return scene_state
    }

    if (Array.isArray(key)) {
      return key.reduce(
        (acc, k) => {
          acc[k] = scene_state[k]
          return acc
        },
        {} as T,
      )
    }
    if (typeof key === 'string') {
      return scene_state[key]
    }
  }
}
