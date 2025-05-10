import { Module } from '@nestjs/common'
import { StageService } from './stage.service'
import * as Stage from './scenes'

@Module({
  imports: [],
  providers: [StageService, Stage.VerificationRequestScene],
  exports: [StageService],
})
export class StageModule {}
