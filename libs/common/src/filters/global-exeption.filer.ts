import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'
import { TypeORMError, QueryFailedError } from 'typeorm'

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message: any = 'Internal server error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      message = exception.getResponse()
    } else if (exception instanceof TypeORMError) {
      status = HttpStatus.BAD_REQUEST
      message = {
        error: 'Database Error',
        detail: exception.message,
      }

      if (exception instanceof QueryFailedError) {
        message.query = (exception as any).query
        message.parameters = (exception as any).parameters
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    }

    response.status(status).json(errorResponse)
  }
}
