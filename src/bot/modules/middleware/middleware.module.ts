import { Module } from '@nestjs/common';
import { MiddlewareService } from './middleware.service';
import { MiddlewareHelper } from '@app/bot/helpers';
import { BusinessModule, ClientModule, UserProfileModule } from '@app/domain';
import { ComposerModule } from '../composer';

@Module({
  imports: [UserProfileModule, ClientModule, BusinessModule, ComposerModule],
  providers: [MiddlewareService, MiddlewareHelper],
  exports: [MiddlewareService],
})
export class MiddlewareModule {}