import { TypedConfigService } from '@app/infrastructure/config'
import {
  DatabaseService,
  passActivationRequest,
  PassActivationRequestInsertModel,
  PassActivationRequestSelectModel,
  Transaction,
} from '@app/infrastructure/database'
import { PassActivationRequestCacheKey, RedisCacheService } from '@app/infrastructure/redis'
import { AuditLogEntity, AuditLogOperation, AuditLogServiceOperation } from '@app/libs'
import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

@Injectable()
export class PassActivationRequestService {
  private studioId: string

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: TypedConfigService,
    private readonly redisCacheService: RedisCacheService,
  ) {
    this.studioId = this.configService.getStudioId()
  }

  async createActivationRequest(
    data: PassActivationRequestInsertModel,
    tx?: Transaction,
  ): Promise<[PassActivationRequestSelectModel, AuditLogServiceOperation[]]> {
    const dbProvider = tx || this.databaseService.drizzle

    const [createdRequest] = await dbProvider.insert(passActivationRequest).values(data).returning()
    await this.redisCacheService.reset()
    return [
      createdRequest,
      [
        {
          entity: AuditLogEntity.PASS_ACTIVATION_REQUEST,
          entityId: createdRequest.id,
          operation: AuditLogOperation.CREATE,
          payload: data,
          timestamp: new Date().toISOString(),
          metadata: { serviceName: PassActivationRequestService.name, methodName: this.createActivationRequest.name },
        },
      ],
    ]
  }

  async deleteActivationRequest(id: string, tx?: Transaction): Promise<[boolean, AuditLogServiceOperation[]]> {
    const dbProvider = tx || this.databaseService.drizzle
    const result = await dbProvider.delete(passActivationRequest).where(eq(passActivationRequest.id, id)).returning()

    if (result.length) {
      await this.redisCacheService.reset()
    }

    return [
      true,
      [
        {
          entity: AuditLogEntity.PASS_ACTIVATION_REQUEST,
          entityId: id,
          operation: AuditLogOperation.DELETE,
          payload: {},
          timestamp: new Date().toISOString(),
          metadata: { serviceName: PassActivationRequestService.name, methodName: this.deleteActivationRequest.name },
        },
      ],
    ]
  }

  async findById(id: string) {
    const cacheKey = PassActivationRequestCacheKey.getById(id)

    const cachedRequest = await this.redisCacheService.get<typeof result>(cacheKey)
    if (cachedRequest) {
      return cachedRequest
    }

    const result = await this.databaseService.drizzle.query.passActivationRequest.findFirst({
      where: (passActivationRequest, { eq }) => eq(passActivationRequest.id, id),
      with: {
        client: {
          with: {
            userProfile: true,
          },
        },
        pass: {
          with: {
            passTemplate: true,
          },
        },
      },
    })

    if (result) {
      await this.redisCacheService.set(cacheKey, result)
    }

    return result
  }

  async findAllStudioRequests() {
    const cacheKey = PassActivationRequestCacheKey.studioRequests(this.studioId)

    const cachedRequests = await this.redisCacheService.get<typeof results>(cacheKey)

    if (cachedRequests) {
      return cachedRequests
    }

    const results = await this.databaseService.drizzle.query.passActivationRequest.findMany({
      where: (passActivationRequest, { eq }) => eq(passActivationRequest.studioId, this.studioId),
      with: {
        client: {
          with: {
            userProfile: true,
          },
        },
        pass: {
          with: {
            passTemplate: true,
          },
        },
      },
      orderBy: (passActivationRequest, { desc }) => desc(passActivationRequest.createdAt),
    })

    if (results) {
      await this.redisCacheService.set(cacheKey, results)
    }

    return results
  }
}
