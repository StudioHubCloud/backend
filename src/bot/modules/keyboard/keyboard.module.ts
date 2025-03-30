import { Global, Module } from '@nestjs/common'
import { KeyboardService } from './keyboard.service'
import { KeyboardHelper } from '@app/bot/helpers'

@Global()
@Module({
  imports: [],
  providers: [KeyboardService, KeyboardHelper],
  exports: [KeyboardService],
})
export class KeyboardModule {}
