import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { Studio } from './studio.entity'
import type { GroupStyle } from './group-style.entity'

@Entity({ name: 'group_style_variant' })
export class GroupStyleVariant extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string

  @ManyToOne('Studio', (studio: Studio) => studio.group_styles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: Studio

  @ManyToOne('GroupStyle', (group_style: GroupStyle) => group_style.group_style_variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_style_id' })
  group_style: GroupStyle
}
