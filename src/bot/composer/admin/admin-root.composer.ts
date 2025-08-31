import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { ClientManageComposer } from './client-manage/client-manage.composer'
import { StaffManageComposer } from './staff-manage/staff-manage.composer'
import { GroupManageComposer } from '@app/bot/composer/common/group-manage.composer'
import { VerificationRequestComposer } from './verification-request/verification-request.composer'
import { MESSAGES_STAFF } from '@app/bot/static/messages'
import { AdminKeyboards } from '@app/bot/keyboard/storage'

@Injectable()
export class AdminRootComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly clientManageComposer: ClientManageComposer,
    private readonly staffManageComposer: StaffManageComposer,
    private readonly groupManageComposer: GroupManageComposer,
    private readonly requestVerificationComposer: VerificationRequestComposer,
  ) {
    this.composer = new Composer<BotContext>()

    this.composer.start(async (ctx) => {
      return ctx.reply(MESSAGES_STAFF.GREETINGS_ADMIN, AdminKeyboards.mainMenu())
    })

    this.initExternalComposers()
  }

  middleware() {
    return this.composer.middleware()
  }

  initExternalComposers() {
    this.composer.use(this.clientManageComposer.middleware())
    this.composer.use(this.staffManageComposer.middleware())
    this.composer.use(this.groupManageComposer.middleware())
    this.composer.use(this.requestVerificationComposer.middleware())
  }
}
