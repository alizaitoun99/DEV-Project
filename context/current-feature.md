# Current feature: Prisma + Neon PostgreSQL Setup

Set up Prisma 7 with Neon PostgreSQL using the [database spec](features/database-spec.md).

## Status: Completed

## goals

- Add `script/test-db.ts` with dotenv loading and read-only connection/table checks, available through `npm run db:check`.

- Add and run a repeatable development seed from `src/lib/mock-data.ts`, preserving fixture relationships and file metadata without fabricating uploads.

- Configure Prisma 7 with Neon serverless PostgreSQL.
- Create the initial schema from the data models in [project-overview.md](project-overview.md), including the NextAuth models `Account`, `Session`, and `VerificationToken`.
- Add appropriate indexes, relationships, and cascade deletes.
- Create versioned migrations for the initial schema.

## notes

- 2026-10-25: Added `prisma/seed.ts` and `npm run db:seed` using the dashboard fixtures. Seeded the development database and reran successfully with unchanged counts: 1 user, 7 system types, 6 collections, 9 items, 19 tags, 11 collection memberships, and 20 item-tag links. Existing records are preserved; no uploaded objects or passwords are created. Lint and TypeScript passed. Production build failed in Turbopack's CSS worker (`node process exited before we could connect`), including a retry outside the sandbox.

- Before implementation, read the entire [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) and consult the [setup guide](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/prisma-postgres) for version-specific configuration and adapter requirements.
- `DATABASE_URL` will point to the Neon development branch; production will use a separate Neon branch.
- Always create migrations for schema changes; never use `prisma db push`. Use `prisma migrate dev` for development and `prisma migrate deploy` for production.
- 2026-10-25: Applied the versioned initial migration `20261025120000_init` to the configured Neon development branch with `npm run db:migrate`. Migration status is up to date, all ten model tables passed the Neon adapter connectivity check, and Prisma Client was regenerated. Production must apply the same migration with `npm run db:deploy`.

## History project

- 2026-10-25: Completed Prisma + Neon PostgreSQL setup on `feature/neon-prisma`: Prisma 7 schema/client and Neon adapter, versioned initial migration applied to development, repeatable mock-data seed, and dotenv-backed `script/test-db.ts`. Migration status and all ten table queries passed; seed rerun preserved counts. Lint, TypeScript, and the final `npm run build` passed, including compilation, static generation, and optimization. Earlier CSS worker failures did not recur on the final build. Production must apply versioned migrations with `npm run db:deploy`; never use `prisma db push`.

- 2026-10-25: Set [Prisma + Neon PostgreSQL Setup](features/database-spec.md) as the current feature with status "In Progress".
- 2026-10-25: Completed [Dashboard UI Phase 3](features/dashboard-phase-3-spec.md) on `feature/dashboard-phase-3`. Built the main dashboard with four statistics cards, recent collections, pinned items, and up to ten recent items using mock data. Added reusable collection/item cards with type colors, tags, dates, and favorite/pinned indicators.
- 2026-10-25: Recent items are sorted by `updatedAt` descending and capped at ten; all nine mock items are displayed, including pinned items when applicable. Recent collections share the sidebar's ordering by their members' latest `lastOpenedAt`; five qualify because Context Files has no opened items. Collection counts and dominant-type accents are derived from memberships, with system-type order breaking ties. Collection pages and item drawer actions remain outside this layout phase.
- 2026-10-25: Phase 3 validation passed: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and browser checks at 320px, 390px, 768px, and 1920px with no horizontal overflow. Verified desktop sidebar collapse/expand and mobile drawer open/Escape dismissal.
- 2026-10-25: Closed out Dashboard UI Phase 3 at the user's request: marked Completed, moved implementation details to project history, and cleared goals and notes.
- 2026-10-25: Set Dashboard UI Phase 3 as the current feature with status "In progress".
- 2026-10-25: Completed [Dashboard UI Phase 2](features/dashboard-phase-2-spec.md) on `feature/dashboard-phase-2`. Delivered a collapsible desktop sidebar and mobile drawer with a toggle icon, focus trapping, Escape dismissal, and focus restoration. Added `/items/TYPE` links and item counts, favorite and recent collections, and the mock user's avatar initials, email, and plan.
- 2026-10-25: Derived recent collections from their items' latest `lastOpenedAt` values because mock collections have no timestamps. Item and collection destination pages remain outside this phase; prefetching is disabled for those planned routes.
- 2026-10-25: Phase 2 validation passed: lint, TypeScript, production build, desktop collapse/expand, mobile drawer keyboard behavior, and responsive overflow checks. Screenshots: [desktop](../artifacts/dashboard-phase-2-desktop.png) and [mobile](../artifacts/dashboard-phase-2-mobile.png).
- 2026-10-25: Closed out Dashboard UI Phase 2 at the user's request: marked Completed, moved implementation details to project history, and cleared goals and notes.
- 2026-10-25: Started Dashboard UI Phase 2 on `feature/dashboard-phase-2` and implemented the sidebar.
- 2026-10-25: Set Dashboard UI Phase 2 as the current feature with status "Not started".
- 2026-10-23: Completed the dashboard mock-data file with seven types, six collections, and nine representative items.
- 2026-10-23: Added Dashboard UI Phase 1 as the current feature with status "In-depth progress".
- 2026-10-23: Completed Dashboard UI Phase 1 and verified the production build and responsive dashboard shell.
- 2026-10-23: Delivered the dark-by-default `/dashboard` shell with shadcn Button and Input, a display-only top bar, and Sidebar/Main placeholders. Aligned `eslint-config-next` with Next.js 16.4.2. Lint, TypeScript, production build, and desktop/mobile browser checks passed. Screenshots: [desktop](../artifacts/dashboard-phase-1-desktop.png) and [mobile](../artifacts/dashboard-phase-1-mobile.png).
- 2026-10-23: Committed as `858ec08` (`feat: implement dashboard phase 1`), merged into local `main`, and deleted `feature/dashboard-phase-1`.
- 2026-10-23: Closed out Dashboard UI Phase 1 at the user's request: kept status Completed, recorded the results in project history, and cleared goals and notes. Repeat this closeout when the user declares a feature finished.
