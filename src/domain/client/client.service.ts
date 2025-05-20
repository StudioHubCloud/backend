import { Injectable } from '@nestjs/common'
import { UserProfileService } from '../user-profile'
import { client, DatabaseService, UserProfileInsertModel } from '@app/infrastructure/database'

@Injectable()
export class ClientService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async createNewClient(data: UserProfileInsertModel) {
    return this.databaseService.drizzle.transaction(async (tx) => {
      const userProfile = await this.userProfileService.createUserProfile(data, tx)
      await tx.insert(client).values({ userProfileId: userProfile.id }).returning()
      return userProfile
    })
  }
}
