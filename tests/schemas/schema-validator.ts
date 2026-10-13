import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { SchemaValidationResult } from '../interfaces/api-response.interface';

export class SchemaValidator {
  private static readonly ajv: Ajv = addFormats(new Ajv({ allErrors: true, strict: true }));

  /** Validates data against a typed schema; errors are human-readable. */
  public static validate<T>(schema: JSONSchemaType<T>, data: unknown): SchemaValidationResult {
    const validateFn: ValidateFunction<T> = SchemaValidator.ajv.compile(schema);
    const valid: boolean = validateFn(data);
    const errors: string[] = (validateFn.errors ?? []).map(
      (e): string => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`,
    );
    return { valid, errors };
  }
}
