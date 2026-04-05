import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ParseZodPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          error: 'VALIDATION_ERROR',
          code: 'VALIDATION_FAILED',
          details: error.errors,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
