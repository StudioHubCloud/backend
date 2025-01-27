import { Logger } from '@nestjs/common'

export abstract class AbstractService {
  protected readonly logger = new Logger(this.constructor.name)

  constructor() {}

  protected log(message: string) {
    this.logger.log(message)
  }
}
