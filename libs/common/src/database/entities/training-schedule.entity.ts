import { CreateDateColumn, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { UserProfile } from './user-profile.entity'
import type { Training } from './training.entity'
import type { Pass } from './pass.entity'

@Entity({ name: 'training_schedule' })
export class TrainingSchedule extends Mixin(UuidIdBaseMixin) {
  @ManyToOne('Training', (t: Training) => t.training_schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_id' })
  training: Training

  @ManyToOne('Pass', (p: Pass) => p.training_schedules, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'pass_id' })
  pass: Pass | null

  @ManyToOne('UserProfile', {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date
}
