import { Module } from '@nestjs/common';
import { MiddlewareService } from './middleware.service';
import { StudioModule, ClientModule, UserProfileModule } from '@app/domain';

@Module({
  imports: [UserProfileModule, ClientModule, StudioModule],
  providers: [MiddlewareService],
  exports: [MiddlewareService],
})
export class MiddlewareModule {}