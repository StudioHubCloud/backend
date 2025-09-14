import { Module } from '@nestjs/common'
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
import { LoggerModule, ConfigModule, DatabaseModule, RedisCacheModule, CronModule, HealthModule } from '@app/infrastructure'
import { BotModule } from 'src/bot/bot.module'

@Module({
  imports: [
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
