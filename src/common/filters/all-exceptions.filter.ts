import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : (r as Record<string, unknown>);
    } else if (
      exception instanceof Prisma.PrismaClientValidationError ||
      (exception instanceof Error &&
        exception.name === 'PrismaClientValidationError')
    ) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
      status = HttpStatus.BAD_REQUEST;
      body = {
        message:
          'The request could not be processed. Please refresh the page and try again.',
        code: 'PRISMA_VALIDATION',
      };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { message: 'Resource already exists', code: exception.code };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { message: 'Resource not found', code: exception.code };
      } else {
        status = HttpStatus.BAD_REQUEST;
        body = { message: exception.message, code: exception.code };
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      const isPrismaLike =
        exception.message.includes('prisma') ||
        exception.message.includes('Invalid `') ||
        exception.message.includes('Unknown argument');
      body = {
        message: isPrismaLike
          ? 'Something went wrong while saving. Please try again.'
          : exception.message,
      };
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...body,
    });
  }
}
