import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { timingSafeEqual } from 'crypto'
import { TypedConfigService } from '@app/infrastructure/config'
import { APP } from '@app/libs/constants'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: TypedConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(APP.DECORATOR_KEYS.IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const providedKey = request.headers['x-api-key']

    if (typeof providedKey !== 'string' || !this.isValidKey(providedKey)) {
      throw new UnauthorizedException('Invalid or missing API key')
    }

    return true
  }

  private isValidKey(providedKey: string): boolean {
    const expectedKey = this.configService.get('INTERNAL_API_KEY')
    const provided = Buffer.from(providedKey)
    const expected = Buffer.from(expectedKey)

    if (provided.length !== expected.length) {
      timingSafeEqual(provided, provided)
      return false
    }

    return timingSafeEqual(provided, expected)
  }
}
