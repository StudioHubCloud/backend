import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { KeyboardHelper, UserHelper } from '@app/bot/helpers'
import { ClientManageComposer } from './client-manage/client-manage.composer'
import { StaffManageComposer } from './staff-manage/staff-manage.composer'
import { GroupManageComposer } from './group-manage/group-manage.composer'
import { VerificationRequestComposer } from './verification-request/verification-request.composer'

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
      const role = UserHelper.getUserRole(ctx)
      return ctx.reply('Вітаю в панелі адміністратора!', KeyboardHelper.getRoleBasedMainMenuKeyboard(role))
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
