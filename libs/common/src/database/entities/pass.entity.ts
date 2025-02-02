import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import { PASS, PassStatus } from '@app/common'
import type { TrainingSchedule } from './training-schedule.entity'
import type { Group } from './group.entity'
import type { Client } from './client.entity'

@Entity({ name: 'pass' })
export class Pass extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'int' })
  price: number

  @Column({ type: 'int' })
  length: number

  @Column({ type: 'timestamp' })
  start_date: Date

  @Column({ type: 'timestamp' })
  end_date: Date

  @Column({ type: 'timestamp', nullable: true })
  paused_from_date: Date | null

  @Column({ type: 'timestamp', nullable: true })
  paused_to_date: Date | null

  @Column({ type: 'timestamp', nullable: true })
  expired_from_date: Date | null

  @Column({ type: 'enum', enum: Object.values(PASS.STATUS) })
  status: PassStatus

  @ManyToOne('Group', (group: Group) => group.passes, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group: Group | null

  @ManyToOne('Client', (client: Client) => client.passes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  client: Client

  @OneToMany('TrainingSchedule', (ts: TrainingSchedule) => ts.pass)
  training_schedules: TrainingSchedule[]
}
