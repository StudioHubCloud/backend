import { Global, Module } from '@nestjs/common'
import { StartHandler } from './services'

@Global()
@Module({
  imports: [],
  providers: [StartHandler],
  exports: [StartHandler],
})
export class HandlersModule {}
