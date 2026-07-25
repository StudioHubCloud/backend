import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import {
  CustomerModule,
  StudioModule,
  ClientModule,
  UserProfileModule,
  TrainingModule,
  PassTemplateModule,
  GroupAgeRestrictionExeptionModule,
  GroupAgeRestrictionModule,
  FeedbackNotificationModule,
  PaymentModule,
  StaffMemberModule,
  StudioPayoutRuleModule,
  StaffMemberPayoutModule,
  PassActivationRequestModule,
  UserRegisterModule,
} from '@app/domain'
import {
  AuditLogModule,
  LoggerModule,
  ConfigModule,
  DatabaseModule,
  RedisCacheModule,
  CronModule,
  HealthModule,
  MetricsModule,
} from '@app/infrastructure'
import { BotModule } from '@app/bot/bot.module'
import { ApiKeyGuard } from '@app/libs'

@Module({
  imports: [
    AuditLogModule,
    MetricsModule,
    CustomerModule,
    StudioModule,
    ClientModule,
    LoggerModule,
    TrainingModule,
    ConfigModule,
    DatabaseModule,
    RedisCacheModule,
    UserProfileModule,
    HealthModule,
    BotModule,
    CronModule,
    GroupAgeRestrictionModule,
    GroupAgeRestrictionExeptionModule,
    PassTemplateModule,
    FeedbackNotificationModule,
    PaymentModule,
    StaffMemberModule,
    StudioPayoutRuleModule,
    StaffMemberPayoutModule,
    PassActivationRequestModule,
    UserRegisterModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
