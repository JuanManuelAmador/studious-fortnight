import { allure } from 'allure-playwright';
import { expect, test } from '../fixtures/api.fixture';
import { HttpStatus } from '../config/constants';
import { UserFactory } from '../factories/user.factory';
import { ApiResponse } from '../interfaces/api-response.interface';
import { CreateUserRequest, ErrorResponse, User } from '../interfaces/user.interface';
import { errorResponseSchema } from '../schemas/error-response.schema';
import { SchemaValidator } from '../schemas/schema-validator';
import { userSchema } from '../schemas/user.schema';
import { UsersClient } from '../clients/users.client';
import { UserTracker } from '../fixtures/api.fixture';

interface InvalidPayloadCase {
  title: string;
  payload: Record<string, unknown>;
}

/** Tags a test as a known bug and links it to BUGS.md. */
async function markBug(id: string, title: string): Promise<void> {
  await allure.issue(id, `BUGS.md#${id.toLowerCase()}`);
  await allure.description(`Known bug ${id}: ${title}. See BUGS.md.`);
}

/** Creates a user through the client and registers it for cleanup. */
async function seedUser(client: UsersClient, tracker: UserTracker, overrides: Partial<CreateUserRequest> = {}): Promise<User> {
  return test.step('Arrange: seed a user', async (): Promise<User> => {
    const payload: CreateUserRequest = UserFactory.build(overrides);
    tracker.track(payload.email);
    const response: ApiResponse<User | ErrorResponse> = await client.create(payload);
    expect(response.status, 'seed user must be created (201)').toBe(HttpStatus.CREATED);
    return response.body as User;
  });
}

test.describe('Users API - CRUD', () => {
  test.beforeEach(async (): Promise<void> => {
    await allure.epic('User Management API');
  });

  test.describe('GET /users', () => {
    test.beforeEach(async (): Promise<void> => {
      await allure.feature('List users');
    });

    test('returns 200 and an array containing a valid User', async ({ usersClient, createdUsers }): Promise<void> => {
      const user: User = await seedUser(usersClient, createdUsers);

      const response: ApiResponse<User[]> = await test.step('Act: GET /users', () => usersClient.getAll());

      await test.step('Assert: status 200, body is an array, seeded user matches schema', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(Array.isArray(response.body)).toBe(true);
        // The shared list may hold invalid records created by other parallel (bug) tests,
        // so the schema is checked on the user this test created.
        const seeded: User | undefined = response.body.find((u: User): boolean => u.email === user.email);
        expect(seeded, 'seeded user must be listed').toBeDefined();
        expect(SchemaValidator.validate(userSchema, seeded).errors).toEqual([]);
      });
    });

    test('includes a newly created user', async ({ usersClient, createdUsers }): Promise<void> => {
      const user: User = await seedUser(usersClient, createdUsers);

      const response: ApiResponse<User[]> = await test.step('Act: GET /users', () => usersClient.getAll());

      await test.step('Assert: list contains the created user', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toContainEqual(user);
      });
    });
  });

  test.describe('POST /users', () => {
    test.beforeEach(async (): Promise<void> => {
      await allure.feature('Create user');
    });

    test('creates a user and returns 201 with the payload', async ({ usersClient, createdUsers }): Promise<void> => {
      const payload: CreateUserRequest = UserFactory.build();
      createdUsers.track(payload.email);

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: POST /users', () => usersClient.create(payload));

      await test.step('Assert: 201, body equals payload, schema valid', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toEqual(payload);
        expect(SchemaValidator.validate(userSchema, response.body).errors).toEqual([]);
      });
    });

    for (const age of [1, 150]) {
      test(`accepts boundary age ${age}`, async ({ usersClient, createdUsers }): Promise<void> => {
        const payload: CreateUserRequest = UserFactory.build({ age });
        createdUsers.track(payload.email);

        const response: ApiResponse<User | ErrorResponse> = await test.step(`Act: POST /users with age ${age}`, () => usersClient.create(payload));

        await test.step('Assert: 201 and age preserved', async (): Promise<void> => {
          expect(response.status).toBe(HttpStatus.CREATED);
          expect((response.body as User).age).toBe(age);
        });
      });
    }

    const missingFields: Array<keyof CreateUserRequest> = ['name', 'email', 'age'];
    for (const field of missingFields) {
      test(`rejects a missing "${field}" with 400`, async ({ usersClient }): Promise<void> => {
        const payload: Record<string, unknown> = { ...UserFactory.without(field) };

        const response: ApiResponse<User | ErrorResponse> = await test.step(`Act: POST /users without ${field}`, () => usersClient.createRaw(payload));

        await test.step('Assert: 400 and error schema', async (): Promise<void> => {
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
        });
      });
    }

    const invalidCases: InvalidPayloadCase[] = [
      { title: 'age 0', payload: { age: 0 } },
      { title: 'age 151', payload: { age: 151 } },
      { title: 'age -1', payload: { age: -1 } },
      { title: 'age 30.5 (non-integer)', payload: { age: 30.5 } },
      { title: 'age "30" (string)', payload: { age: '30' } },
      { title: 'empty name', payload: { name: '' } },
    ];
    for (const invalid of invalidCases) {
      test(`rejects ${invalid.title} with 400`, async ({ usersClient, createdUsers }): Promise<void> => {
        const body: Record<string, unknown> = { ...UserFactory.build(), ...invalid.payload };
        createdUsers.track(String(body.email));

        const response: ApiResponse<User | ErrorResponse> = await test.step(`Act: POST /users with ${invalid.title}`, () => usersClient.createRaw(body));

        await test.step('Assert: 400 and error schema', async (): Promise<void> => {
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
        });
      });
    }

    test('rejects malformed JSON with 400', async ({ usersClient }): Promise<void> => {
      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: POST /users with malformed JSON', () => usersClient.createRaw('{bad json'));

      await test.step('Assert: 400', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    test('[BUG-004] rejects an invalid email format with 400', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
      await markBug('BUG-004', 'POST accepts invalid email format');
      const body: Record<string, unknown> = { ...UserFactory.build(), email: 'not-an-email' };
      createdUsers.track('not-an-email');

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: POST /users with email "not-an-email"', () => usersClient.createRaw(body));

      await test.step('Assert: 400 (spec: format email)', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    test('[BUG-005] rejects a non-string name with 400', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
      await markBug('BUG-005', 'POST accepts non-string name');
      const body: Record<string, unknown> = { ...UserFactory.build(), name: 123 };
      createdUsers.track(String(body.email));

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: POST /users with numeric name', () => usersClient.createRaw(body));

      await test.step('Assert: 400 (spec: name is a string)', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    test('[BUG-002] rejects a duplicate email with 409', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
      await markBug('BUG-002', 'Duplicate email returns 500 instead of 409');
      const user: User = await seedUser(usersClient, createdUsers);

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: POST /users with an existing email', () =>
        usersClient.create(UserFactory.build({ email: user.email })),
      );

      await test.step('Assert: 409 and error schema', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.CONFLICT);
        expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
      });
    });
  });

  test.describe('GET /users/{email}', () => {
    test.beforeEach(async (): Promise<void> => {
      await allure.feature('Get user by email');
    });

    test('returns 200 with the user', async ({ usersClient, createdUsers }): Promise<void> => {
      const user: User = await seedUser(usersClient, createdUsers);

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: GET /users/{email}', () => usersClient.getByEmail(user.email));

      await test.step('Assert: 200, equals created user, schema valid', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toEqual(user);
        expect(SchemaValidator.validate(userSchema, response.body).errors).toEqual([]);
      });
    });

    test('[BUG-001] returns 404 for a non-existent user', { tag: '@bug' }, async ({ usersClient }): Promise<void> => {
      await markBug('BUG-001', 'GET unknown user returns 500 instead of 404');

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: GET /users/{unknown}', () =>
        usersClient.getByEmail(UserFactory.uniqueEmail('ghost')),
      );

      await test.step('Assert: 404 and error schema', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
        expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
      });
    });
  });

  test.describe('PUT /users/{email}', () => {
    test.beforeEach(async (): Promise<void> => {
      await allure.feature('Update user');
    });

    test('returns 200 with the updated body', async ({ usersClient, createdUsers }): Promise<void> => {
      const user: User = await seedUser(usersClient, createdUsers);
      const update: CreateUserRequest = UserFactory.buildUpdate(user);

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: PUT /users/{email}', () => usersClient.update(user.email, update));

      await test.step('Assert: 200 and body equals update', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toEqual(update);
      });
    });

    test('[BUG-003] persists the update (GET returns new values)', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
      await markBug('BUG-003', 'PUT returns 200 but does not persist changes');
      const user: User = await seedUser(usersClient, createdUsers);
      const update: CreateUserRequest = UserFactory.buildUpdate(user);

      await test.step('Act: PUT /users/{email}', () => usersClient.update(user.email, update));
      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: GET /users/{email} after update', () => usersClient.getByEmail(user.email));

      await test.step('Assert: GET returns the updated user', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toEqual(update);
      });
    });

    test('[BUG-003] email change: new email is retrievable', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
      await markBug('BUG-003', 'PUT with a new email does not persist');
      const user: User = await seedUser(usersClient, createdUsers);
      const newEmail: string = createdUsers.track(UserFactory.uniqueEmail('renamed'));

      await test.step('Act: PUT changing the email', () => usersClient.update(user.email, UserFactory.buildUpdate(user, { email: newEmail })));
      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: GET /users/{newEmail}', () => usersClient.getByEmail(newEmail));

      await test.step('Assert: new email returns 200', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.OK);
        expect((response.body as User).email).toBe(newEmail);
      });
    });

    test('returns 404 for a non-existent user', async ({ usersClient }): Promise<void> => {
      const ghost: string = UserFactory.uniqueEmail('ghost');

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: PUT /users/{unknown}', () =>
        usersClient.update(ghost, UserFactory.build({ email: ghost })),
      );

      await test.step('Assert: 404 and error schema', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
        expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
      });
    });

    const invalidUpdates: InvalidPayloadCase[] = [
      { title: 'age 0', payload: { age: 0 } },
      { title: 'age 151', payload: { age: 151 } },
      { title: 'invalid email', payload: { email: 'bad' } },
    ];
    for (const invalid of invalidUpdates) {
      test(`rejects ${invalid.title} with 400`, async ({ usersClient, createdUsers }): Promise<void> => {
        const user: User = await seedUser(usersClient, createdUsers);
        const body: Record<string, unknown> = { ...UserFactory.buildUpdate(user), ...invalid.payload };

        const response: ApiResponse<User | ErrorResponse> = await test.step(`Act: PUT with ${invalid.title}`, () => usersClient.updateRaw(user.email, body));

        await test.step('Assert: 400 and error schema', async (): Promise<void> => {
          expect(response.status).toBe(HttpStatus.BAD_REQUEST);
          expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
        });
      });
    }

    test('rejects a missing name with 400', async ({ usersClient, createdUsers }): Promise<void> => {
      const user: User = await seedUser(usersClient, createdUsers);
      const body: Record<string, unknown> = { email: user.email, age: user.age };

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: PUT without name', () => usersClient.updateRaw(user.email, body));

      await test.step('Assert: 400', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    test('returns 409 when the new email belongs to another user', async ({ usersClient, createdUsers }): Promise<void> => {
      const first: User = await seedUser(usersClient, createdUsers);
      const second: User = await seedUser(usersClient, createdUsers);

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: PUT first user using second user email', () =>
        usersClient.update(first.email, UserFactory.buildUpdate(first, { email: second.email })),
      );

      await test.step('Assert: 409 and error schema', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.CONFLICT);
        expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
      });
    });
  });

  test.describe('DELETE /users/{email}', () => {
    test.beforeEach(async (): Promise<void> => {
      await allure.feature('Delete user');
    });

    test('deletes a user with the injected token (204) and removes it from the list', async ({ usersClient, createdUsers }): Promise<void> => {
      const user: User = await seedUser(usersClient, createdUsers);

      const response: ApiResponse<ErrorResponse | null> = await test.step('Act: DELETE /users/{email}', () => usersClient.delete(user.email));
      const list: ApiResponse<User[]> = await test.step('Act: GET /users', () => usersClient.getAll());

      await test.step('Assert: 204 and user absent from list', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.NO_CONTENT);
        expect(list.body.map((u: User): string => u.email)).not.toContain(user.email);
      });
    });

    test('[BUG-001] returns 404 on GET after delete', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
      await markBug('BUG-001', 'GET of a deleted user returns 500 instead of 404');
      const user: User = await seedUser(usersClient, createdUsers);
      await test.step('Act: DELETE /users/{email}', () => usersClient.delete(user.email));

      const response: ApiResponse<User | ErrorResponse> = await test.step('Act: GET /users/{email} after delete', () => usersClient.getByEmail(user.email));

      await test.step('Assert: 404', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
      });
    });

    test('returns 404 for a non-existent user (with token)', async ({ usersClient }): Promise<void> => {
      const response: ApiResponse<ErrorResponse | null> = await test.step('Act: DELETE /users/{unknown}', () =>
        usersClient.delete(UserFactory.uniqueEmail('ghost')),
      );

      await test.step('Assert: 404 and error schema', async (): Promise<void> => {
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
        expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
      });
    });
  });
});
