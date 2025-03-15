import { Injectable } from '@nestjs/common'
import { Composer, Context } from 'grammy'

@Injectable()
export class StaffMainComposer extends Composer<Context> {
  constructor() {
    super()
  }
}
