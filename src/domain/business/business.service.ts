import { Inject, Injectable } from '@nestjs/common'
import { Database, DATABASE_CONNECTION } from '@app/infrastructure/database'

@Injectable()
export class BusinessService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async getBusinessById(id: string) {
    return this.db.query.business.findFirst({ where: (business, { eq }) => eq(business.id, id) })
  }
}
