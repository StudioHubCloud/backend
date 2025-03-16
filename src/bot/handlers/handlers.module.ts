import { Global, Module } from '@nestjs/common'
import { BusinessModule } from 'src/domain'
import { StartHandler } from './services'

@Global()
@Module({
  imports: [BusinessModule],
  providers: [StartHandler],
  exports: [StartHandler],
})
export class HandlersModule {}
