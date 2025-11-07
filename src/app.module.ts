import { Module } from '@nestjs/common'
import { BotModule } from 'src/bot/bot.module'
import {
  LoggerModule,
  ConfigModule,
  DatabaseModule,
  RedisCacheModule,
  CronModule,
  HealthModule,
  AuditLogModule,
} from '@app/infrastructure'
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
} from '@app/domain'

@Module({
  imports: [
    AuditLogModule,
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
  ],
  providers: [],
})
export class AppModule {}
