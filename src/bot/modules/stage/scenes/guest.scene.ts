import { Scenes } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { SCENES } from '@app/libs'
import { BotHelper } from '@app/bot/helpers/bot.helper'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { SceneHelper } from '@app/bot/helpers/scene.helper'

@Injectable()
export class VerificationRequestScene extends Scenes.WizardScene<BotContext> {
  verification_request_scene = new SceneHelper<{ name: string | null }>()
  constructor() {
    super(
      SCENES.VERIFICATION_REQUEST,
      (ctx) => this.sceneEnterHandler(ctx),
      (ctx) => this.secondHandler(ctx),
      (ctx) => this.thirdHandler(ctx),
    )

    this.enter((ctx: BotContext, next) => {
      ctx.reply('Entering the guest_example scene.') //call next or reply with valid CTA
      console.log(ctx.scene.state, 'scene state')
    })

    this.leave((ctx: BotContext) => {
      ctx.reply('Leaving the guest_example scene.')
    })

    this.command('leave', (ctx: BotContext) => {
      ctx.scene.leave()
    })
  }

  private sceneEnterHandler = async (ctx: BotContext) => {
    await ctx.reply(MESSAGES_SCENE.VERIFICATION.PROVIDE_NAME)
    return ctx.wizard.next()
  }

  private secondHandler = async (ctx: BotContext) => {
    //expects name
    const text = BotHelper.getUpdatePayload(ctx)
    this.verification_request_scene.setState(ctx, { name: text })
    ctx.reply('This is the second handler')
    return ctx.wizard.next()
  }
  private thirdHandler = async (ctx: BotContext) => {
    //expects phone
    ctx.reply('This is the third handler')
    const data = this.verification_request_scene.getState(ctx, ['name'])
    console.log(data, 'in third handler')
  }
}
