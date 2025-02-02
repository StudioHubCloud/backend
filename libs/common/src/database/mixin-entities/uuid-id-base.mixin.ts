import { v4 } from 'uuid'
import { decorate } from 'ts-mixer'
import { PrimaryColumn } from 'typeorm'

export class UuidIdBaseMixin {
  @decorate(PrimaryColumn({ type: 'uuid', generated: 'uuid' }))
  id: string = v4()
}
