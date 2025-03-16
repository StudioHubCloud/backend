import { Global, Module } from '@nestjs/common'
import { StartHandler } from './files'
import { BusinessModule } from '@app/modules/domain'

@Global()
@Module({
  imports: [BusinessModule],
  providers: [StartHandler],
  exports: [StartHandler],
})
export class HandlersModule {}
