import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'

@Injectable()
export class ClientComposer extends Composer<Context> {
  constructor() {
    super()
  }
}
