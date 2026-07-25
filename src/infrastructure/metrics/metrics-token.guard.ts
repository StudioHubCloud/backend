import { timingSafeEqual } from 'crypto'
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Request } from 'express'
import { TypedConfigService } from '../config'

@Injectable()
export class MetricsTokenGuard implements CanActivate {
  constructor(private readonly configService: TypedConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const authorizationHeader = request.headers.authorization ?? ''
    const providedToken = authorizationHeader.startsWith('Bearer ') ? authorizationHeader.slice('Bearer '.length) : ''

    return this.isTokenValid(providedToken)
  }

  private isTokenValid(providedToken: string): boolean {
    const expectedToken = this.configService.get('METRICS_TOKEN')
    
    console.log('Expected Token:', expectedToken)
    console.log('Provided Token:', providedToken)

    const provided = Buffer.from(providedToken)
    const expected = Buffer.from(expectedToken)

    if (provided.length !== expected.length) {
      return false
    }

    return timingSafeEqual(provided, expected)
  }
}
