import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'

@Injectable()
export class StaffComposer extends Composer<Context> {
  constructor() {
    super()
  }
}
