import { TypedConfigService } from '@app/infrastructure/config'
import { DatabaseService } from '@app/infrastructure/database'
import { PassTemplateCacheKey, RedisCacheService } from '@app/infrastructure/redis'
import { Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class PassTemplateService {
  private studioId: string
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
  ) {
    this.studioId = this.configService.get('STUDIO_ID')
  }

  async getAll() {
    const cacheKey = PassTemplateCacheKey.allInStudio(this.studioId)

    const cachedTemplates = await this.redisCacheService.get<typeof passTemplates>(cacheKey)

    if (cachedTemplates) {
      return cachedTemplates
    }

    const passTemplates = await this.databaseService.drizzle.query.passTemplate.findMany({
      where: (passTemplate, { eq }) => eq(passTemplate.studioId, this.studioId),
    })

    if (passTemplates.length) {
      await this.redisCacheService.set(cacheKey, passTemplates)
    }

    return passTemplates
  }

  async getById(id: string) {
    const cacheKey = PassTemplateCacheKey.getById(id)

    const cachedTemplate = await this.redisCacheService.get<typeof template>(cacheKey)
    if (cachedTemplate) {
      return cachedTemplate
    }

    const template = await this.databaseService.drizzle.query.passTemplate.findFirst({
      where: (passTemplate, { eq }) => eq(passTemplate.id, id),
      with: {
        passTemplateAgeRestriction: true,
        passTemplateAgeRestrictionExceptions: true,
      },
    })

    if (!template) {
      throw new NotFoundException(`Pass template with id: ${id} not found`)
    }

    await this.redisCacheService.set(cacheKey, template)
    return template
  }
}
