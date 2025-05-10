import { Injectable } from '@nestjs/common'
import { DatabaseService, studio, StudioSelectModel } from '@app/infrastructure/database'
import { GroupStatusEnum } from '@app/libs'

@Injectable()
export class StudioService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStudioById(studioId: string) {
    return await this.databaseService.drizzle.query.studio.findFirst({
      where: (studio, { eq }) => eq(studio.id, studioId),
    })
  }

  async getAllStudiosWithActiveGroups(filters: Partial<StudioSelectModel> = {}) {
    return await this.databaseService.drizzle.query.studio.findMany({
      where: (studio, { and, eq }) => and(...Object.entries(filters).map(([key, value]) => eq(studio[key], value))),
      with: {
        groups: {
          where: (groups, { eq }) => eq(groups.status, GroupStatusEnum.ACTIVE),
          with: {
            groupSchedules: {
              with: {
                groupScheduleDays: true,
              },
            },
          },
        },
      },
    })
  }
}
