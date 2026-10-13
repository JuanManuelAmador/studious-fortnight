import { allure } from 'allure-playwright';
import { expect, test } from '../fixtures/api.fixture';
import { AUTH_HEADER, HttpStatus } from '../config/constants';
import { UserFactory } from '../factories/user.factory';
import { ApiResponse } from '../interfaces/api-response.interface';
import { ErrorResponse, User } from '../interfaces/user.interface';
import { errorResponseSchema } from '../schemas/error-response.schema';
import { SchemaValidator } from '../schemas/schema-validator';
import { UsersClient } from '../clients/users.client';
import { UserTracker } from '../fixtures/api.fixture';

async function markBug6(): Promise<void> {
  await allure.issue('BUG-006', 'BUGS.md#bug-006');
  await allure.description('Known bug BUG-006: DELETE without a valid token is allowed on dev. See BUGS.md.');
}

async function seedUser(client: UsersClient, tracker: UserTracker): Promise<User> {
  return test.step('Arrange: seed a user', async (): Promise<User> => {
    const email: string = tracker.track(UserFactory.uniqueEmail());
    const response: ApiResponse<User | ErrorResponse> = await client.create(UserFactory.build({ email }));
    expect(response.status, 'seed user must be created (201)').toBe(HttpStatus.CREATED);
    return response.body as User;
  });
}

test.describe('Auth - DELETE token enforcement', () => {
  test.beforeEach(async (): Promise<void> => {
    await allure.epic('User Management API');
    await allure.feature('Authentication');
  });

  test('accepts the token injected by the fixture (204)', async ({ usersClient, createdUsers }): Promise<void> => {
    const user: User = await seedUser(usersClient, createdUsers);

    const response: ApiResponse<ErrorResponse | null> = await test.step('Act: DELETE with injected token', () => usersClient.delete(user.email));

    await test.step('Assert: 204', async (): Promise<void> => {
      expect(response.status).toBe(HttpStatus.NO_CONTENT);
    });
  });

  test('[BUG-006] rejects DELETE without the Authentication header (401)', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
    await markBug6();
    const user: User = await seedUser(usersClient, createdUsers);

    const response: ApiResponse<ErrorResponse | null> = await test.step('Act: DELETE without token', () => usersClient.delete(user.email, { token: null }));

    await test.step('Assert: 401 and error schema', async (): Promise<void> => {
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(SchemaValidator.validate(errorResponseSchema, response.body).errors).toEqual([]);
    });
  });

  test('[BUG-006] rejects DELETE with an invalid token (401)', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
    await markBug6();
    const user: User = await seedUser(usersClient, createdUsers);

    const response: ApiResponse<ErrorResponse | null> = await test.step('Act: DELETE with invalid token', () => usersClient.delete(user.email, { token: 'wrong-token' }));

    await test.step('Assert: 401', async (): Promise<void> => {
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  test(`[BUG-006] rejects a valid token sent in the wrong header "Authorization" (401)`, { tag: '@bug' }, async ({ usersClient, createdUsers, authToken }): Promise<void> => {
    await markBug6();
    const user: User = await seedUser(usersClient, createdUsers);

    const response: ApiResponse<ErrorResponse | null> = await test.step(`Act: DELETE with token in "Authorization" instead of "${AUTH_HEADER}"`, () =>
      usersClient.delete(user.email, { token: authToken, headerName: 'Authorization' }),
    );

    await test.step('Assert: 401', async (): Promise<void> => {
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  test('[BUG-006] a rejected DELETE leaves the user intact', { tag: '@bug' }, async ({ usersClient, createdUsers }): Promise<void> => {
    await markBug6();
    const user: User = await seedUser(usersClient, createdUsers);
    await test.step('Act: DELETE without token', () => usersClient.delete(user.email, { token: null }));

    const response: ApiResponse<User | ErrorResponse> = await test.step('Act: GET /users/{email}', () => usersClient.getByEmail(user.email));

    await test.step('Assert: user still exists (200)', async (): Promise<void> => {
      expect(response.status).toBe(HttpStatus.OK);
    });
  });
});
