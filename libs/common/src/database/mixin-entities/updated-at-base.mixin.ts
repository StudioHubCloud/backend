import { decorate } from 'ts-mixer'
import { Column, Index } from 'typeorm'

export class UpdatedAtBaseMixin {
  @decorate(Index(() => ['updated_at']))
  @decorate(
    Column({
      name: 'updated_at',
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
      nullable: true,
    }),
  )
  updated_at?: Date
}
