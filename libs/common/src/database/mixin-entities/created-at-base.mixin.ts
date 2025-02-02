import { decorate } from 'ts-mixer'
import { Column, Index } from 'typeorm'

export class CreatedAtBaseMixin {
  @decorate(Index(() => ['created_at']))
  @decorate(
    Column({
      name: 'created_at',
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
      nullable: true,
    }),
  )
  created_at?: Date
}
