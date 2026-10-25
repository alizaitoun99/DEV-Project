# Database setup

This project uses Prisma ORM 7 and Neon PostgreSQL. Node.js 20.19+, 22.12+, or 24+ is required. The CLI, client, and Neon adapter must stay on the same Prisma 7 version.

## Local configuration

Fill in the ignored root `.env` file with the two connection strings from **the same Neon development branch**:

```dotenv
# Pooled connection for application queries (hostname contains -pooler).
DATABASE_URL="postgresql://USER:PASSWORD@ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
# Direct connection for Prisma CLI commands (hostname has no -pooler).
DIRECT_URL="postgresql://USER:PASSWORD@ENDPOINT.REGION.aws.neon.tech/neondb?sslmode=require"
```

Copy the strings from Neon's Connect dialog and retain its TLS parameters. Never put credentials in source control or a `NEXT_PUBLIC_` variable. The production deployment must use its own Neon branch and environment variables.

## Prisma 7 configuration

- `prisma.config.ts` explicitly loads `.env` with `dotenv` and supplies the direct CLI URL. URLs are no longer stored in the schema datasource.
- `prisma/schema.prisma` uses the `prisma-client` generator with output in `src/generated/prisma`. Generated code is ignored and regenerated during install and build.
- `src/lib/prisma.ts` uses `PrismaNeon`, requires `DATABASE_URL`, prevents client-side imports with `server-only`, and reuses the client during development hot reloads.
- Import `prisma` from `@/lib/prisma` only in server code. CLI scripts load `.env` explicitly; Next.js loads it automatically. Keep database variables in the root `.env` so both use the same configuration.
- Prisma 7 migration commands do not automatically generate the client; run generation explicitly after schema changes.

## Migrations

After credentials are configured, apply the initial migration to the development branch:

```sh
npm run db:migrate
npm run db:generate
npm run db:status
npm run db:check
```

For subsequent schema changes:

```sh
npm run db:migrate -- --name describe_change --create-only
# Review generated SQL and add any required custom constraints/indexes.
npm run db:migrate
npm run db:generate
npm run db:status
```

Never use `prisma db push`. Production must run `npm run db:deploy` with production's direct URL before starting the app. Do not run development migrations against production. Review SQL and test migrations on a staging branch before deployment.

The initial migration is generated from the project overview, with an Auth.js-compatible Session primary key, indexes for foreign-key lookups, a partial unique index for global system slugs, and a check tying system/custom types to their ownership. User deletion cascades through owned data and authentication records; deleting a collection or tag removes memberships, not items. Deleting a referenced item type is restricted, while deleting a collection's default type clears that default.

Cross-owner membership/type authorization, content-kind validation, immutable system types, normalized tag slugs, full-text search, and R2 cleanup must be enforced when the corresponding services are implemented. This foundation does not expose database access through public routes or replace the mock dashboard data. Sample data is created only by the explicit development seed below.

## Development seed

Run `npm run db:seed` to populate the development database configured by `DATABASE_URL` from [the seed specification](../context/features/seed-spec.md). This is separate from migrations and rejects `NODE_ENV=production`.

The seed upserts `demo@devistage.io` (John Doe) with password `12345678`, hashed using bcryptjs with 12 rounds, current email verification, and `plan: PRO`. It creates seven system types, five collections, and 18 items: four snippets, three prompts, five commands, and six links. No file uploads or authentication sessions are created.

Reruns refresh the specified demo fields and reuse stable, user-scoped IDs without duplicating items or memberships. System types are matched by global slug and updated to the specified names, Lucide component icons, colors, and storage kinds. Other records are preserved. All writes run in one transaction; ownership conflicts abort it. The main dashboard queries this account directly from the database.

On 2026-10-26, the earlier John Doe and demo accounts were merged into this account, retaining the original demo user ID so seed IDs remain stable. All 27 items, 11 collections, 19 tags, 29 collection memberships, and 20 tag memberships were preserved, including two pinned items. The one-time development merge is recorded in `script/merge-demo-users.ts`; it aborts on unexpected account conflicts.

## Verification

```sh
npm run db:validate
npm run db:generate
npm run lint
npx tsc --noEmit
npm run build
```

These checks work without database credentials. `db:status`, migrations, and `db:check` require real connection strings. `db:check` runs read-only checks through the Neon adapter and displays database-wide table counts, the demo profile, system types, and seeded items with content previews. It verifies the demo password and bcrypt cost without printing the hash, PRO plan, email verification, seven type definitions, collection/type counts, text content, URL syntax, and owned memberships. Seed-specific assertions select records with the `demo-` ID prefix, allowing merged content to coexist. Run `npm run db:seed` first; missing or mismatched demo data produces a nonzero exit code. It does not modify data or request external link URLs.

References: [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [Neon + Prisma](https://neon.com/docs/guides/prisma), [Auth.js Prisma adapter](https://authjs.dev/getting-started/adapters/prisma).
