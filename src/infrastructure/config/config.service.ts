import { Injectable } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { Env } from './environments'
import { LeafTypes, Leaves } from '@app/libs/types'
import { ENVIRONMENTS } from '@app/libs'

@Injectable()
export class TypedConfigService {
  constructor(private configService: NestConfigService) {}

  get<T extends Leaves<Env>>(propertyPath: T): LeafTypes<Env, T> {
    return this.configService.get(propertyPath) as LeafTypes<Env, T>
  }

  isProduction(): boolean {
    return this.configService.get('NODE_ENV') === ENVIRONMENTS.PRODUCTION
  }

  getToken(): string {
    const token = this.configService.get(this.isProduction() ? 'BOT_TOKEN' : 'BOT_TOKEN_TEST')
    if (!token) {
      throw new Error('Bot token is not provided')
    }
    return token
  }

  getStudioId(): string {
    const studioId = this.configService.get(this.isProduction() ? 'STUDIO_ID' : 'STUDIO_ID_TEST')
    if (!studioId) {
      throw new Error('Studio ID is not provided')
    }
    return studioId
  }
}
