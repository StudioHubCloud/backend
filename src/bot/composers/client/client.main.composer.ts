import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'

@Injectable()
export class ClientMainComposer extends Composer<Context> {
  constructor() {
    super()
  }
}
