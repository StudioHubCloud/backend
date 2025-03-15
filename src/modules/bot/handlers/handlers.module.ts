import { Global, Module } from '@nestjs/common'
import { StartHandler } from './files'

@Global()
@Module({
  imports: [],
  providers: [StartHandler],
  exports: [StartHandler],
})
export class HandlersModule {}
