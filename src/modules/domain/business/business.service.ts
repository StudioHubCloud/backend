import { Inject, Injectable } from '@nestjs/common'
import { DataBase, DATABASE_CONNECTION } from '@app/modules/infrastructure/database'

@Injectable()
export class BusinessService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DataBase) {}

  async getBusinessById(id: string) {
    return this.db.query.business.findFirst({ where: (business, { eq }) => eq(business.id, id) })
  }
}
