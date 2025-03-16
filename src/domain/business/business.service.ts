import { Injectable } from '@nestjs/common'
import { DatabaseService } from '@app/infrastructure/database'

@Injectable()
export class BusinessService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getBusinessById(id: string) {
    return this.databaseService.drizzle.query.business.findFirst({ where: (business, { eq }) => eq(business.id, id) })
  }
}
