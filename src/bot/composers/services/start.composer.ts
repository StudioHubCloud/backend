import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'
import { StartHandler } from '../../handlers'

@Injectable()
export class StartComposer extends Composer<Context> {
  constructor(private readonly startHandler: StartHandler) {
    super()
    this.on(':text', this.startHandler.welcomeHandler)
  }
}
