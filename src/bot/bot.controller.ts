import { Controller, Post, Req } from '@nestjs/common'
import { BotService } from './bot.service'
import { Update } from 'grammy/types'

@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('telegram/webhook')
  async handleUpdate(@Req() req: Request) {
    const update = req.body as unknown as Update
    await this.botService.handleUpdate(update)
  }
}
