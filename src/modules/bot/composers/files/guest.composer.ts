import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'

@Injectable()
export class GuestComposer extends Composer<Context> {
  constructor() {
    super()
  }
}
