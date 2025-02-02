import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm'
import { Mixin } from 'ts-mixer'
import { UuidIdBaseMixin } from '../mixin-entities'
import type { GroupStyleVariant } from './group-style-variant.entity'
import type { Studio } from './studio.entity'
import type { Group } from './group.entity'

@Entity({ name: 'group_style' })
export class GroupStyle extends Mixin(UuidIdBaseMixin) {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @ManyToOne('Studio', (studio: Studio) => studio.group_styles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: Studio

  @OneToMany('Group', (group: Group) => group.group_style, { cascade: true })
  groups: Group[]

  @OneToMany(
    'GroupStyleVariant',
    (group_style_variant: GroupStyleVariant) => group_style_variant.group_style,
  )
  group_style_variants: GroupStyleVariant[]
}
