import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { mongo } from 'mongoose';

/** Turns MongoDB duplicate-key errors into 409 instead of a generic 500. */
@Catch(mongo.MongoServerError)
export class MongoExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(exception: InstanceType<typeof mongo.MongoServerError>, host: ArgumentsHost) {
    if (exception.code === 11000) {
      const field = Object.keys(
        (exception.keyValue as Record<string, unknown> | undefined) ?? {},
      )[0];
      const error: HttpException = new ConflictException(
        field ? `${field} is already taken` : 'Duplicate value',
      );
      return super.catch(error, host);
    }
    return super.catch(exception, host);
  }
}
