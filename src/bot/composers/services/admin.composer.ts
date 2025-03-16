import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'

@Injectable()
export class AdminComposer extends Composer<Context> {
  constructor() {
    super()
  }
}
