import { decorate } from 'ts-mixer'
import { Column, Index } from 'typeorm'

export class DeletedAtBaseMixin {
  @decorate(Index(() => ['deleted_at']))
  @decorate(Column({ name: 'deleted_at', type: 'timestamp', nullable: true }))
  deleted_at?: Date
}
