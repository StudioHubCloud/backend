import { DatabaseService, group, GroupSelectModel } from '@app/infrastructure/database';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class GroupService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAllGroups(filters: Partial<GroupSelectModel> = {}) {
    return await this.databaseService.drizzle
      .select()
      .from(group)
      .where(and(...Object.entries(filters).map(([key, value]) => eq(group[key], value))))
  }
}
