import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SCENES } from '@app/libs'
import { SceneHelper, BotHelper } from '@app/bot/helpers'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { Keyboards } from '@app/bot/modules/keyboard'

interface IVerificationRequestSceneState {
  name: string | null
  phone?: string | null
  date_of_birth?: string | null
  role?: string | null
}

@Injectable()
export class VerificationRequestScene extends Scenes.WizardScene<BotContext> {
  private readonly scene = new SceneHelper<IVerificationRequestSceneState>()
  constructor() {
    super(
      SCENES.VERIFICATION_REQUEST,
      (ctx) => this.enterSceneHandler(ctx),
      (ctx) => this.nameHandler(ctx),
    )
  }

  //cursor 0; asks for name
  private enterSceneHandler = async (ctx: BotContext) => {
    console.log(this.scene.getState(ctx))
    await ctx.reply(MESSAGES_SCENE.VERIFICATION.PROVIDE_NAME, { reply_markup: { remove_keyboard: true } })
    return ctx.wizard.next()
  }

  //cursor 1; expects name
  private nameHandler = async (ctx: BotContext) => {
    console.log(ctx.wizard.cursor, ctx.scene.state)
    const data = BotHelper.getUpdatePayload(ctx)
    console.log(data, 'data')
    await ctx.reply('asd', Keyboards.client.mainMenu())
    ctx.scene.leave()
  }
}
