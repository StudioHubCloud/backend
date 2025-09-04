import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { MESSAGES_STAFF } from '@app/bot/static/messages'
import { TrainerKeyboards } from '@app/bot/keyboard/storage'
import { GroupManageStaffComposer } from '../common/group-manage-staff.composer'
import { PayoutStaffComposer } from '../common/payout-staff.composer'

@Injectable()
export class TrainerRootComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly groupManageComposer: GroupManageStaffComposer,
    private readonly payoutStaffComposer: PayoutStaffComposer,
  ) {
    this.composer = new Composer<BotContext>()

    this.composer.start(async (ctx) => {
      ctx.reply(MESSAGES_STAFF.GREETINGS_TRAINER, TrainerKeyboards.mainMenu())
    })

    this.initExternalComposers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initExternalComposers() {
    this.composer.use(this.groupManageComposer.middleware())
    this.composer.use(this.payoutStaffComposer.middleware())
  }
}
