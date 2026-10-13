import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { CreateUserRequest, UpdateUserRequest, User } from '../interfaces/user.interface';

export class UserFactory {
  public static uniqueEmail(prefix: string = 'qa'): string {
    const worker: string = process.env.TEST_WORKER_INDEX ?? '0';
    return `${prefix}.w${worker}.${randomUUID()}@example.com`.toLowerCase();
  }

  public static build(overrides: Partial<CreateUserRequest> = {}): CreateUserRequest {
    return {
      name: faker.person.fullName(),
      email: UserFactory.uniqueEmail(),
      age: faker.number.int({ min: 18, max: 90 }),
      ...overrides,
    };
  }

  public static buildUpdate(base: User, overrides: Partial<UpdateUserRequest> = {}): UpdateUserRequest {
    return {
      name: `${base.name} Updated`,
      email: base.email,
      age: base.age === 150 ? 149 : base.age + 1,
      ...overrides,
    };
  }

  public static without<K extends keyof CreateUserRequest>(field: K): Omit<CreateUserRequest, K> {
    const payload: CreateUserRequest = UserFactory.build();
    const { [field]: _removed, ...rest } = payload;
    void _removed;
    return rest;
  }
}
