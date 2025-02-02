import { Column, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { GroupSchedule } from './group-schedule.entity'

export class GroupScheduleDay extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'int', unique: true })
  day_index: number

  @Column({ type: 'varchar', length: 255, unique: true })
  day_title_long: string

  @Column({ type: 'varchar', length: 255, unique: true })
  day_title_short: string

  @OneToMany('GroupSchedule', (groupSchedule: GroupSchedule) => groupSchedule.group_schedule_day, {
    cascade: false,
  })
  group_schedules: GroupSchedule[]
}
