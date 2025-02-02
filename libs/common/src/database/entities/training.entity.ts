import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { Group } from './group.entity'
import type { StaffMember } from './staff-member.entity'
import type { TrainingSchedule } from './training-schedule.entity'

@Entity({ name: 'training' })
@Index(['date', 'is_cancelled'])
@Index('training_is_cancelled_true', { where: 'is_cancelled = true' })
export class Training extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'timestamp' })
  date: Date

  @Column({ type: 'boolean' })
  is_cancelled: boolean

  @ManyToOne('Group', (group: Group) => group.trainings, { onDelete: 'CASCADE' })
  group: Group

  @ManyToOne('StaffMember', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trainer_id' })
  trainer: StaffMember | null

  @OneToMany('TrainingSchedule', (ts: TrainingSchedule) => ts.training)
  training_schedules: TrainingSchedule[]
}
