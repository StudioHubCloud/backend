import { PrimaryGeneratedColumn } from 'typeorm'

export class AbstractEntity<T> {
  @PrimaryGeneratedColumn('uuid')
  id: number

  constructor(entity: Partial<T>) {
    Object.assign(this, entity)
  }
}
