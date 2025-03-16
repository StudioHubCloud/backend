import { DatabaseService } from '@app/infrastructure/database'
import { Injectable } from '@nestjs/common'

@Injectable()
export class UserProfileService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserProfileById(id: string) {
    return this.databaseService.drizzle.query.userProfile.findFirst({ where: (userProfile, { eq }) => eq(userProfile.id, id) })
  }

  async createUserProfile(data: any) {
    // return this.databaseService.drizzle.mutation.userProfile.create({ data })
  }
}
