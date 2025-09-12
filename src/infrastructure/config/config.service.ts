import { Injectable } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { Env } from './environments'
import { LeafTypes, Leaves } from '@app/libs/types'
import { ENVIRONMENTS } from '@app/libs'

@Injectable()
export class TypedConfigService {
  constructor(private configService: NestConfigService) {}

  get<T extends Leaves<Env>>(propertyPath: T): LeafTypes<Env, T> {
    if (propertyPath === 'STUDIO_ID') {
      const isProduction = this.configService.get('NODE_ENV') === ENVIRONMENTS.PRODUCTION
      return this.configService.get(isProduction ? 'STUDIO_ID' : 'STUDIO_ID_TEST') as LeafTypes<Env, T>
    }
    return this.configService.get(propertyPath) as LeafTypes<Env, T>
  }
}
