import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { Pass } from './pass.entity'
import type { Studio } from './studio.entity'
import type { Training } from './training.entity'
import type { GroupStyle } from './group-style.entity'
import type { GroupSchedule } from './group-schedule.entity'
import type { StaffMember } from './staff-member.entity'

@Entity({ name: 'group' })
export class Group extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'int' })
  capacity: number

  @Column({ type: 'int', nullable: true })
  min_age_requirement: number | null

  @OneToMany('Training', (training: Training) => training.group, { cascade: ['insert', 'remove'] })
  trainings: Training[]

  @OneToMany('Pass', (pass: Pass) => pass.group)
  passes: Pass[]

  @OneToMany('GroupSchedule', (group_schedule: GroupSchedule) => group_schedule.group, {
    cascade: true,
  })
  group_schedules: GroupSchedule[]

  @ManyToOne('Studio', (studio: Studio) => studio.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: Studio

  @ManyToOne('GroupStyle', (group_style: GroupStyle) => group_style.groups, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'group_style_id' })
  group_style: GroupStyle

  @ManyToOne('StaffMember', (sm: StaffMember) => sm.groups, {
    nullable: true,
    onDelete: 'SET NULL',
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({ name: 'staff_member_id' })
  trainer: StaffMember | null
}
