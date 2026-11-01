# Item types

Research date: 2026-10-31. Scope: repository definitions and current display behavior; no live database query or seed execution.

DevStash defines seven built-in item types backed by one `Item` model. The type's `ContentKind` determines whether its primary payload is text, a URL, or a stored file. Dashboard summaries are implemented; item CRUD, editors, uploads, downloads, and specialized previews remain planned in the project overview.

## Type reference

Hex colors below are the values in `prisma/seed.ts`, also reflected in the project overview and static fixtures. Icons show the seed's stored name and the actual dashboard component where its name differs. Payload fields describe intended usage; they are nullable in the current schema and are not evidence of implemented type-specific validation.

| Name / slug | Lucide icon | Hex color | Kind | Purpose | Key payload fields |
|---|---|---|---|---|---|
| Snippet / `snippet` | `Code` | `#3b82f6` | TEXT | Reusable source code, hooks, configuration, and boilerplate | `content`; optional `language` for syntax identification |
| Prompt / `prompt` | `Sparkles` | `#8b5cf6` | TEXT | Reusable AI instructions and workflows | `content`; seed examples include literal placeholders such as `{{diff}}` and `{{code}}` |
| Note / `note` | `StickyNote` | `#fde047` | TEXT | Developer notes, explanations, and Markdown knowledge | `content`; optional shared `description` |
| File / `file` | `File` | `#6b7280` | FILE | Uploaded documents and other binary assets | `fileKey`, `fileName`, `fileSize`, `fileMimeType` |
| Image / `image` | `Image` → `ImageIcon` | `#ec4899` | FILE | Uploaded screenshots, diagrams, and visual references | `fileKey`, `fileName`, `fileSize`, `fileMimeType`; no separate dimensions or image model |
| Link / `link` | `Link` → `LinkIcon` | `#10b981` | URL | Bookmarks for documentation, tools, and resources | `url`; optional `content` for notes, separate from the destination |
| Command / `command` | `Terminal` | `#f97316` | TEXT | Reusable shell and CLI commands | `content`; `language` is available but not populated by the command seed examples |

Commands are intended as text to copy, never commands executed by DevStash. Prompt placeholders are stored text; the inspected sources do not implement a template substitution engine.

### Storage classification

- **TEXT:** snippet, prompt, note, command. Primary payload is `content` (`String? @db.Text`). Markdown editing and syntax highlighting are planned.
- **URL:** link. Destination is `url` (`String? @db.Text`), independently of optional notes in `content`. The overview requires safe HTTP/HTTPS URLs for future mutations.
- **FILE:** file, image. `fileKey` is intended to identify a private R2 object, not a public URL. `fileSize` is nullable `BigInt` in Prisma; `fileName` and `fileMimeType` are nullable strings. Upload authorization, download access, and storage cleanup belong to the planned asset lifecycle.

All payload fields exist on the same model. The inspected schema and initial migration do not enforce a required payload or exclusivity by kind. Do not interpret an optional schema field as a completed validator or upload implementation.

## Shared properties and relationships

Every item has required `id`, owner `userId`, `typeId`, and `title`, plus `createdAt` and automatically maintained `updatedAt`. Optional `description` is shared across types. `isFavorite` and `isPinned` default to false and are independent. Nullable `lastOpenedAt` supports the planned recently opened behavior; the current dashboard's recent-items query orders by `updatedAt`, then ID.

Items support zero or more collections through `ItemCollection`, which records `addedAt`, and zero or more tags through `ItemTag`. Collection membership is many-to-many; a collection can mix types. `Collection.defaultTypeId` is an optional quick-add default in the design, not a restriction on its members. Owner consistency across related records requires application checks beyond ordinary foreign keys.

`ItemType` contains `id`, `slug`, `name`, `icon`, `color`, `kind`, `isSystem`, and optional `userId`. The seed creates all seven as global system types with `isSystem: true` and `userId: null`. It sets the stored `name` to the lowercase singular slug, whereas static fixtures use plural display names such as “Snippets.” The database-backed sidebar renders the stored name directly.

The initial migration enforces unique system slugs with a partial index and enforces that system types have no owner while custom types have an owner. Prisma also declares per-owner slug uniqueness. System-type immutability is a product requirement; these constraints alone do not prevent updates. Custom types are a future feature, although their ownership relationship is already modeled.

## Display differences

### Implemented dashboard

- `TypeIcon.tsx` maps slugs to Lucide components and Tailwind icon/left-border colors. Unknown slugs fall back to the file style. It does not read the database's stored `icon` or `color`.
- `DashboardSidebar.tsx` has its own slug mapping for matching icons, color classes, and plural route segments: `/items/snippets`, `/items/prompts`, `/items/notes`, `/items/files`, `/items/images`, `/items/links`, and `/items/commands`. These are navigation targets; corresponding item page implementations are absent from `src/app` at research time. Counts come from the signed-in owner's items.
- The color classes are blue-500, violet-500, yellow-300, gray-500, pink-500, emerald-500, and orange-500 respectively. The stored hex values are metadata; the components use Tailwind tokens rather than those literal hex values.
- `ItemCard.tsx` uses the same structure for all seven types: type icon, colored left border, title, description, tags, updated date, and optional pin/star indicators. The summary query does not load content, URL, language, or file metadata. Cards do not currently show code blocks, Markdown bodies, image thumbnails, download actions, or destination links.
- Collection cards show the types present and derive their border from the most common type. Ties use snippet → prompt → command → note → file → image → link, with a slug tie-breaker afterward. Empty collections use a neutral border. Recent sidebar collections use the same dominant-type color for their circle.

### Planned type-specific behavior

The overview calls for Markdown editing, syntax highlighting, and an item drawer with create/view/edit/copy actions, including copying snippets, commands, and prompts. Files and images need private uploads/downloads; links retain their destination separately from notes. These are design requirements, not current card capabilities. Production access is planned as Free for text types and links, Pro for files/images; development mode is intended to expose features while building, and server-side entitlement enforcement remains planned.

## Seed coverage

`prisma/seed.ts` defines all seven system types but supplies 18 item definitions across five collections: four snippets, three prompts, five commands, and six links. It supplies no note, file, or image item examples. Existing database contents can differ because the seed upserts its records without deleting unrelated ones. Static `mock-data.ts` includes file/image display metadata and explicitly states that no upload/download backend exists yet; fixtures are not proof of stored assets.

## Sources and discrepancies

- [Project overview](../context/project-overview.md): purpose, planned item behavior, payload rules, access plans, and implementation boundaries.
- [Prisma schema](../prisma/schema.prisma): authoritative model fields, nullability, kinds, and relationships.
- [Development seed](../prisma/seed.ts): seven system definitions, exact hex colors, icon strings, stored names, and seeded payload examples.
- [Initial migration](../prisma/migrations/20261025120000_init/migration.sql): system slug index and owner constraint.
- [Type icons](../src/components/dashboard/TypeIcon.tsx), [sidebar](../src/components/dashboard/DashboardSidebar.tsx), [item card](../src/components/dashboard/ItemCard.tsx), and [collection card](../src/components/dashboard/CollectionCard.tsx): current rendering.
- [Item queries](../src/lib/db/items.ts) and [collection queries](../src/lib/db/collections.ts): selected fields, owner scoping, ordering, counts, and dominant-type selection.
- [Static fixtures](../src/lib/mock-data.ts): alternative plural labels and illustrative metadata only.

The research prompt names `src/lib/constants.tsx`, but that file does not exist in this checkout. The seed, static fixtures, and dashboard mappings above provide the relevant definitions instead. No external documentation was needed because this report describes repository-specific behavior rather than framework APIs.
