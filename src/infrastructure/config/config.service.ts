import { Injectable } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { Env } from './environments'
import { LeafTypes, Leaves } from '@app/libs/types'

@Injectable()
export class TypedConfigService {
  constructor(private configService: NestConfigService) {}

  get<T extends Leaves<Env>>(propertyPath: T): LeafTypes<Env, T> {
    return this.configService.get(propertyPath) as LeafTypes<Env, T>
  }
}
