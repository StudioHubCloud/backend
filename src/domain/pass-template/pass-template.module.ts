import { Module } from '@nestjs/common'
import { PassTemplateService } from './pass-template.service'

@Module({
  controllers: [],
  providers: [PassTemplateService],
  exports: [PassTemplateService],
})
export class PassTemplateModule {}
