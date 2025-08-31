import { Global, Module } from '@nestjs/common'
import { KeyboardService } from './keyboard.service'

@Global()
@Module({
  imports: [],
  providers: [KeyboardService],
  exports: [KeyboardService],
})
export class KeyboardModule {}
