# Testing

Vitest runs unit tests for Server Actions and utilities only. Component tests, rendering tests, and snapshots are outside this scope. Tests run in Node without jsdom, React Testing Library, or React plugins.

## Commands

- `npm test`: run all unit tests once (also suitable for CI).
- `npm run test:watch`: watch tests during development.
- `npm test -- src/actions/profile.test.ts`: run a single test file.

Before committing, run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. For UI changes, also manually verify affected routes and responsive layouts. There is no coverage threshold configured.

## Writing tests

Colocate `*.test.ts` files with code under `src/actions/` and `src/lib/`. These are the only paths discovered by `vitest.config.ts`; component and existing `script/` tests are excluded. Import `describe`, `it`, `expect`, and `vi` explicitly from `vitest`. The `@/` alias resolves to `src/`.

Focus on observable behavior: input validation, authorization, owner scoping, return values, and failure paths. Mock authentication, Prisma, Redis, email, fetch, and Next.js request APIs such as `headers`, `cookies`, and `revalidatePath` at the dependency boundary. Unit tests must not load environment files or use live infrastructure. See `src/actions/profile.test.ts` for action authorization tests and `src/lib/email-verification-config.test.ts` for utility tests.

`test/setup.ts` mocks the `server-only` build marker so server utilities can be imported outside Next.js. This does not simulate Next.js request context or verify bundler boundaries. Avoid globally enabling the React Server condition. Mock calls and spies are cleared/restored between tests, and environment values set with `vi.stubEnv` are restored. Reset mock implementations in each suite when needed.

## Existing regression scripts

The existing `test:auth-security`, `test:email-verification`, `test:password-reset`, `test:profile`, and `test:rate-limit` scripts continue to use Node's test runner. They are separate from `npm test`; some require database credentials or other integration configuration and can create temporary fixtures. Run relevant scripts explicitly when changing those flows and report any checks that could not run. `db:check` is also a live database check, not a unit test.

No CI pipeline or automated browser suite is added by this setup.
