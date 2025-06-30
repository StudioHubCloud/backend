import { boolean, date, index, smallint, pgTable as table, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { userProfile } from './user-profile.schema'

export const userProfileFeedbackNotification = table(
  'user_profile_feedback_notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lastSentDate: date('last_sent_date', { mode: 'string' }),
    nextDueDate: date('next_due_date', { mode: 'string' }).notNull(),
    currentIntervalDays: smallint('current_interval_days').notNull().default(60), // 2 months initially
    feedbackGiven: boolean('feedback_given').notNull().default(false),
    snoozeCount: smallint('snooze_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    userProfileId: uuid('user_profile_id')
      .references(() => userProfile.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    uniqueIndex().on(table.userProfileId),
    index().on(table.nextDueDate, table.isActive, table.feedbackGiven), // Cron job query
    index().on(table.feedbackGiven, table.isActive), // Analytics queries
  ],
)

export const user_profile_feedback_notification_relations = relations(userProfileFeedbackNotification, ({ one }) => ({
  userProfile: one(userProfile, {
    fields: [userProfileFeedbackNotification.userProfileId],
    references: [userProfile.id],
  }),
}))
