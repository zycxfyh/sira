// 文件路径: libs/common/src/pipes/zod-validation.pipe.ts

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: error.flatten().fieldErrors,
        });
      }
      throw new BadRequestException('Invalid request payload');
    }
  }
}