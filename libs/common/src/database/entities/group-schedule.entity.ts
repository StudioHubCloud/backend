import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { Group } from './group.entity'
import type { GroupScheduleDay } from './group-schedule-day.entity'

@Entity({ name: 'group_schedule' })
export class GroupSchedule extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'timestamp' })
  time: Date

  @ManyToOne('Group', (group: Group) => group.group_schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group

  @ManyToOne('GroupScheduleDay', (gsd: GroupScheduleDay) => gsd.group_schedules, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'group_schedule_day_id' })
  group_schedule_day: GroupScheduleDay
}
