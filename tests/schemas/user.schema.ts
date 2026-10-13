import { JSONSchemaType } from 'ajv';
import { User } from '../interfaces/user.interface';

/** Mirrors components.schemas.User in sdet_challenge_api.yml. */
export const userSchema: JSONSchemaType<User> = {
  type: 'object',
  required: ['name', 'email', 'age'],
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    age: { type: 'integer', minimum: 1, maximum: 150 },
  },
  additionalProperties: true,
};

export const userListSchema: JSONSchemaType<User[]> = {
  type: 'array',
  items: userSchema,
};
