import { JSONSchemaType } from 'ajv';
import { ErrorResponse } from '../interfaces/user.interface';

export const errorResponseSchema: JSONSchemaType<ErrorResponse> = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
  additionalProperties: true,
};
