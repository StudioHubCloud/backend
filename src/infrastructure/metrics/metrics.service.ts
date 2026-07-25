import { Injectable, OnModuleInit } from '@nestjs/common'
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'
import { PinoLogger } from 'nestjs-pino'
import { DatabaseService } from '@app/infrastructure/database'

const METRIC_PREFIX = 'shc_'

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry()

  private readonly httpRequestDurationSeconds: Histogram<'method' | 'route' | 'status_class'>

  private readonly dbPoolTotalConnections: Gauge
  private readonly dbPoolIdleConnections: Gauge
  private readonly dbPoolWaitingRequests: Gauge

  private readonly redisCommandErrorsTotal: Counter<'command'>

  private readonly cronJobErrorsTotal: Counter<'job'>

  private readonly botUpdateDurationSeconds: Histogram<'update_type' | 'status'>

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MetricsService.name)

    this.httpRequestDurationSeconds = new Histogram({
      name: `${METRIC_PREFIX}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_class'],
      registers: [this.registry],
    })

    this.dbPoolTotalConnections = new Gauge({
      name: `${METRIC_PREFIX}db_pool_total_connections`,
      help: 'Total number of clients in the Postgres pool (in use + idle)',
      registers: [this.registry],
      collect: () => {
        this.dbPoolTotalConnections.set(this.databaseService.pool.totalCount)
      },
    })
    this.dbPoolIdleConnections = new Gauge({
      name: `${METRIC_PREFIX}db_pool_idle_connections`,
      help: 'Number of idle clients in the Postgres pool',
      registers: [this.registry],
      collect: () => {
        this.dbPoolIdleConnections.set(this.databaseService.pool.idleCount)
      },
    })
    this.dbPoolWaitingRequests = new Gauge({
      name: `${METRIC_PREFIX}db_pool_waiting_requests`,
      help: 'Number of queued requests waiting for a Postgres pool connection',
      registers: [this.registry],
      collect: () => {
        this.dbPoolWaitingRequests.set(this.databaseService.pool.waitingCount)
      },
    })

    this.redisCommandErrorsTotal = new Counter({
      name: `${METRIC_PREFIX}redis_command_errors_total`,
      help: 'Total number of failed Redis commands',
      labelNames: ['command'],
      registers: [this.registry],
    })

    this.cronJobErrorsTotal = new Counter({
      name: `${METRIC_PREFIX}cron_job_errors_total`,
      help: 'Total number of cron job runs that threw an error',
      labelNames: ['job'],
      registers: [this.registry],
    })

    this.botUpdateDurationSeconds = new Histogram({
      name: `${METRIC_PREFIX}bot_update_duration_seconds`,
      help: 'Telegram update processing duration in seconds',
      labelNames: ['update_type', 'status'],
      registers: [this.registry],
    })
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry, prefix: METRIC_PREFIX })
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics()
  }

  getContentType(): string {
    return this.registry.contentType
  }

  recordHttpRequest(method: string, route: string, statusClass: string, durationSeconds: number): void {
    this.httpRequestDurationSeconds.observe({ method, route, status_class: statusClass }, durationSeconds)
  }

  recordRedisCommandError(command: string): void {
    this.redisCommandErrorsTotal.inc({ command })
  }

  async runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (error) {
      this.cronJobErrorsTotal.inc({ job: jobName })
      throw error
    }
  }

  observeBotUpdate(updateType: string, status: 'success' | 'error', durationSeconds: number): void {
    this.botUpdateDurationSeconds.observe({ update_type: updateType, status }, durationSeconds)
  }
}
