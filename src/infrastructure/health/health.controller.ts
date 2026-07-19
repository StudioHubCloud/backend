import { Controller, Get } from '@nestjs/common'
import { Public } from '@app/libs'

@Controller('health')
export class HealthController {
  constructor() {}

  @Public()
  @Get()
  getHealth() {
    return { status: 'ok' }
  }
}
