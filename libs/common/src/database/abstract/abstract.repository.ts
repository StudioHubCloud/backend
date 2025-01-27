import { EntityManager, FindManyOptions, FindOneOptions, Repository, SaveOptions } from 'typeorm'
import { AbstractEntity } from './abstract.entity'
import { Logger } from '@nestjs/common'

export abstract class AbstractRepository<T extends AbstractEntity<T>> {
  protected abstract readonly logger: Logger

  constructor(
    private readonly repository: Repository<T>,
    private readonly entitymanager: EntityManager,
  ) {}

  async save(entity: T, options?: SaveOptions): Promise<T> {
    return this.entitymanager.save(entity, options)
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options)
  }

  async findMany(options: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options)
  }
  async delete(id: string): Promise<void> {
    await this.repository.delete(id)
  }
}
