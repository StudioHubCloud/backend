import { Injectable } from '@nestjs/common'
import { RedisCacheService } from '@app/infrastructure/redis'
import { TypedConfigService } from '@app/infrastructure/config'

const AI_CALL_COUNTER_TTL_SECONDS = 60 * 60 * 48 // 2 days, well past UTC day rollover

// One unit = one admin question (handleMessage call), not one underlying Anthropic API
// request — a single question can trigger a short internal tool-calling loop, but that's
// an implementation detail the daily cap isn't meant to punish.
@Injectable()
export class AiRateLimiterService {
  constructor(
    private readonly redisCacheService: RedisCacheService,
    private readonly configService: TypedConfigService,
  ) {}

  async tryConsume(): Promise<boolean> {
    const limit = this.configService.get('AI_DAILY_CALL_LIMIT')
    const key = this.getTodayKey()

    const currentCount = (await this.redisCacheService.get<number>(key)) ?? 0
    if (currentCount >= limit) {
      return false
    }

    await this.redisCacheService.set(key, currentCount + 1, AI_CALL_COUNTER_TTL_SECONDS)
    return true
  }

  private getTodayKey(): string {
    const todayUtc = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    return `ai:daily-call-count:${todayUtc}`
  }
}
