import { Controller, Post, Req } from '@nestjs/common'
import { TelegramService } from './telegram.service'
import { Update } from 'grammy/types'

@Controller('bot/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async handleUpdate(@Req() req: Request) {
    const update = req.body as unknown as Update
    await this.telegramService.handleUpdate(update)
  }
}
