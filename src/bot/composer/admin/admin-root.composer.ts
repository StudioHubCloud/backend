import { Composer } from 'telegraf'
import { Injectable } from '@nestjs/common'
import { BotContext } from '@app/bot/bot.context'
import { ClientManageComposer } from './client-manage/client-manage.composer'
import { StaffManageComposer } from './staff-manage/staff-manage.composer'
import { VerificationRequestComposer } from './verification-request/verification-request.composer'
import { GroupManageStaffComposer } from '../common/group-manage-staff.composer'
import { PayoutStaffComposer } from '../common/payout-staff.composer'
import { MESSAGES_STAFF } from '@app/bot/static/messages'
import { AdminKeyboards } from '@app/bot/keyboard/storage'

@Injectable()
export class AdminRootComposer {
  private readonly composer: Composer<BotContext>

  constructor(
    private readonly clientManageComposer: ClientManageComposer,
    private readonly staffManageComposer: StaffManageComposer,
    private readonly requestVerificationComposer: VerificationRequestComposer,
    private readonly payoutStaffComposer: PayoutStaffComposer,
    private readonly groupManageStaffComposer: GroupManageStaffComposer,
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
    //admin only
    this.composer.use(this.clientManageComposer.middleware())
    this.composer.use(this.staffManageComposer.middleware())
    this.composer.use(this.requestVerificationComposer.middleware())
    //common staff
    this.composer.use(this.groupManageStaffComposer.middleware())
    this.composer.use(this.payoutStaffComposer.middleware())
  }
}
