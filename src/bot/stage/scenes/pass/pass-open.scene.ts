import { BotContext } from '@app/bot/bot.context'
import { BotHelper, KeyboardHelper, RegexHelper, SceneHelper, UserHelper } from '@app/bot/helpers'
import { AuditLogHelper } from '@app/bot/helpers/audit-log.helper'
import { MessageHelper } from '@app/bot/helpers/message.helper'
import { ClientKeyboards } from '@app/bot/keyboard/storage'
import { CommonSceneKeyboards, PassRelatedKeyboards } from '@app/bot/keyboard/storage/scene-keyboards'
import { CALLBACK_PREFIX, SCENES } from '@app/bot/libs'
import { BUTTON_PATTERNS } from '@app/bot/static/button-patterns'
import { MESSAGES_SCENE } from '@app/bot/static/messages'
import { PassTemplateService } from '@app/domain/pass-template/pass-template.service'
import { UserProfileService } from '@app/domain/user-profile'
import { DateTimeProvider, DateTimeProviderInjector } from '@app/infrastructure/providers'
import { AuditLogActions, AuditLogTrigger, DATE_FORMAT, PassTemplateTypeEnum } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { Console } from 'console'
import { Scenes } from 'telegraf'
import { IPassOpenSceneState, PassOpenSceneHelper } from './pass-open.scene-helper'

@Injectable()
export class PassOpenScene extends Scenes.WizardScene<BotContext> {
  private readonly passOpenScene = new SceneHelper<IPassOpenSceneState>()
  constructor() {
    super(SCENES.PASS_OPEN, (ctx) => this.enterSceneHandler(ctx))
  }

  private enterSceneHandler = async (ctx: BotContext) => {
    const state = this.passOpenScene.getStateAll(ctx)
  }
}
