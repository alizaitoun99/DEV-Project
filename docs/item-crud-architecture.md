# Unified item CRUD architecture

Research date: 2026-10-31. Status: proposed design, not an implemented feature. This research changes documentation only.

## Recommendation

Use one mutation module, `src/actions/items.ts`, for all seven types, and extend the existing server-only `src/lib/db/items.ts` for reads made directly by Server Components. Use one type-filtered route, `/items/[type]`, with shared list, drawer, and form components. Components choose the editor and preview by type; actions apply the same authenticated persistence workflow to every item.

Type-specific presentation belongs in components. Server validation must still enforce the payload rules for TEXT, URL, and FILE items, validate the selected type, and authorize every related record. Moving presentation decisions out of actions must not make the client the authority on valid data.

## Current implementation

- `Item` already supports all types through `typeId`, nullable text/URL/file payload fields, shared metadata, tags, and collection memberships.
- `src/lib/db/items.ts` supplies owner-scoped pinned/recent items, statistics, and system-type counts. Recent items currently means recently updated, not recently opened.
- Dashboard item cards render summaries only. They have no detail editor or mutation controls.
- Sidebar links already point to plural type routes such as `/items/snippets`; those item pages do not exist yet.
- `src/actions/profile.ts` demonstrates the repository's Server Action convention. `getCurrentUser()` resolves the session and current database user.
- The proxy protects dashboard and profile routes only. New item pages need explicit protection, independently of action authorization.
- Uploads, private asset delivery, item CRUD, and production entitlements are planned. File/image CRUD cannot be considered complete until their asset lifecycle exists.

## Proposed file structure

All paths below are proposed unless marked existing. No separate action or page per item type is needed.

```text
src/
  actions/
    items.ts                       # createItem, updateItem, deleteItem
  lib/
    item-types.ts                  # Pure type/route metadata; no JSX or server imports
    item-validation.ts             # Server-authoritative input and payload schemas
    db/
      items.ts                     # Existing: extend with list/detail/type reads
      collections.ts               # Existing: collection summaries and counts
  types/
    items.ts                       # DTOs, form input, mutation result types
  app/
    items/
      layout.tsx                   # Protected shell, reused sidebar
      page.tsx                     # All types; calls shared list query
      [type]/
        page.tsx                   # Single dynamic type-filtered page
        loading.tsx                # List skeleton
      loading.tsx
      error.tsx                    # Retryable unexpected failures
  components/
    items/
      ItemsView.tsx                # Shared Server Component for list/empty state
      ItemList.tsx                 # Server-rendered summary cards
      ItemDrawer.tsx               # Client: open/mode state, focus, close behavior
      ItemForm.tsx                 # Client: shared fields and action submission
      ItemFields.tsx               # Client: selects type-specific payload editor
      ItemPreview.tsx              # Selects safe presentation for saved payload
      ItemActions.tsx              # Client: edit/copy/delete controls
      DeleteItemDialog.tsx         # Client: accessible delete confirmation
      editors/
        CodeFields.tsx            # Snippet: content + language
        TextFields.tsx            # Prompt/note: text or Markdown editing
        CommandFields.tsx         # Command: text only; no execution
        LinkFields.tsx            # Destination URL + optional notes
        AssetFields.tsx           # File/image: authorized upload reference
    dashboard/
      ItemCard.tsx                 # Existing: retain/reuse summary presentation
      TypeIcon.tsx                 # Existing: consume shared metadata when implemented
```

`item-types.ts` should centralize slug, route segment, label, icon identifier, color, and kind definitions that are currently duplicated in the seed/fixtures/dashboard. UI modules resolve icon identifiers to components. Server code must resolve the actual database type and kind rather than trust metadata submitted by a browser. This is a future implementation step, not a change made by this research.

## Routing and fetching

One `[type]` segment represents a type category, not an item ID. Use explicit mapping rather than removing a trailing “s.”

| Route parameter | Database slug | Kind |
|---|---|---|
| `snippets` | `snippet` | TEXT |
| `prompts` | `prompt` | TEXT |
| `notes` | `note` | TEXT |
| `commands` | `command` | TEXT |
| `links` | `link` | URL |
| `files` | `file` | FILE |
| `images` | `image` | FILE |

For `/items/snippets`, the page awaits `params`, resolves `snippets` to `snippet`, obtains the current user, resolves an available system type, then calls `getItems(user.id, filters)` directly. Unknown type segments return `notFound()`. A valid type with no owned items renders an empty state. `/items` uses the same view without a type filter. Next.js documents dynamic `params` as a Promise; the page must await it. See the [dynamic route guide](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes).

Use `src/app/items/layout.tsx` for the authenticated shell; sibling `/items` routes do not inherit `dashboard/layout.tsx`. Reuse the shell/sidebar components and keep request-specific reads under appropriate Suspense boundaries for the project's enabled Cache Components configuration. Protect new paths in the proxy for redirects, and enforce authentication in pages/queries/actions even when the proxy is bypassed. The current `getCurrentUser()` redirects with a dashboard callback; item-specific return URLs need a validated local callback when implemented.

Recommended query contracts in the server-only read module:

| Query | Responsibility |
|---|---|
| `getAvailableItemType(userId, slug)` | Resolve a global system type; later allow an owned custom type under an explicit route policy |
| `getItems(userId, filters)` | Bounded, paginated summaries filtered by type, collection, favorite, or pin as needed |
| `getItemById(userId, itemId)` | Owned detail payload, owned tags, and owned collection memberships; return null if unavailable |
| Existing summary/stat queries | Preserve dashboard behavior and owner scoping |

Start list ordering with `updatedAt DESC, id ASC`, matching current queries. Use a validated bounded page size and pagination; do not fetch every item's full content or assets for list cards. Detail queries load only the selected item's payload. Never pass a browser-supplied owner ID through to these functions as authority. Return safe DTOs to client components, omitting private object keys and converting file sizes to decimal strings where needed for JSON interoperability.

### Drawer URL state

For an initial implementation, use validated query parameters such as `/items/snippets?item=<id>&mode=edit`, and `?mode=create` for creation. The Server Component loads an owned detail record and passes a safe DTO to the client drawer. Opening and closing updates URL state so reload and browser back work; a missing or inaccessible item gets the same unavailable response. An item from another category should resolve to its canonical category URL after ownership is established. Do not introduce a competing `/items/[id]` route: it conflicts with the meaning of `[type]`. A dedicated detail route, if later needed, can nest under `/items/[type]/[itemId]`.

## Component responsibilities

| Component | Responsibility |
|---|---|
| Route page / `ItemsView` | Authenticate, resolve filters, query Prisma through lib/db, render list and selected detail |
| `ItemList` / existing card | Show shared summaries, type accents, tags, pins/favorites, and detail navigation |
| `ItemDrawer` | Accessible dialog semantics, keyboard dismissal, focus restoration, create/view/edit modes, dirty-form handling |
| `ItemForm` | Shared title/description, tags, collections, create-only type selection, pending/errors, submission, toast feedback |
| `ItemFields` | Choose editor by type slug, then storage-kind fallback for future custom types |
| Editors | Input controls and helpful local feedback; no database access or authorization |
| `ItemPreview` | Safe Markdown/code/text/URL/asset display; no raw untrusted HTML or command execution |
| `ItemActions` / delete dialog | Copy supported text, enter edit mode, confirm deletion, show mutation result |

Keep read-only presentation server-rendered where practical. Client boundaries are for editing, clipboard access, dialogs, and other interactions. Type-specific buttons and previews are UI decisions; all writes still use the same three item actions.

## Unified mutation contracts

`src/actions/items.ts` uses `"use server"` and exports asynchronous `createItem(input)`, `updateItem(itemId, input)`, and `deleteItem(itemId)`. Inputs are untrusted; validation lives in the shared validation module. Return a discriminated `{ success, data, error }` result with optional field errors and minimal safe data, such as the saved ID and canonical type route. Do not return raw database errors or full Prisma records.

Common mutation sequence:

1. Resolve the authenticated user and confirm the database account still exists. Derive `userId` exclusively on the server.
2. Validate input shape and bounded lengths. For edits/deletes, resolve the target using both ID and owner; use ownership in the final write predicate too.
3. Resolve the persisted/selected type and its kind from the database. Only system types are enabled initially. Reject browser attempts to set owner IDs, arbitrary storage keys, timestamps, or type metadata.
4. Enforce payload rules and production entitlements on the server. Validate every supplied collection/tag against the same owner, not merely its existence.
5. Apply the item and membership changes atomically in one transaction. Translate expected unavailable/validation failures into safe results; log unexpected failures without exposing content or secrets.
6. Refresh affected server-rendered views after commit, then return success. Preserve form values on failure and disable duplicate submissions while pending.

### Create

Accept the selected type ID, common editable fields, a kind-appropriate payload, and optional collection/tag IDs. Set owner and timestamps on the server/database. Collection membership is optional; a new item may belong to none or several. A collection's default type can preselect the form but cannot constrain other valid types.

### Update

Initial recommendation: keep an existing item's type immutable in the form and action. This avoids implicit text-to-file conversions and orphaned objects. A separate conversion feature can later define migration rules. Update title, description, payload, flags, and owned memberships with an explicit whitelist. Define membership arrays as complete replacements when supplied; omission leaves them unchanged, while an empty array clears them. Apply the same explicit omitted-versus-null semantics to optional payload fields. Prevent stale overwrites by checking the original `updatedAt` in the write predicate and returning a conflict for reload/retry when it changed.

### Delete

Delete only an owned item after UI confirmation. Existing cascading relations remove its tag and collection join rows; do not delete the collections or tags themselves. Removing an item from one collection is an update to membership, not an item delete. For FILE items, record cleanup durably in the same database transaction before deleting the row. An outbox/job needs a reviewed schema migration and retry processing; the current schema has no such model. Object cleanup must not depend on a browser continuing to run or on an untracked post-response task.

## Payload rules without seven action implementations

| Kind | Server validation | Component behavior |
|---|---|---|
| TEXT | Require nonempty content for saved items; accept an optional bounded language; reject URL/file payload fields | Snippet code editor, prompt/note text editor, command editor |
| URL | Require a parsed HTTP/HTTPS destination; allow optional text notes; reject file payload fields | URL field and optional notes; safe external-link preview |
| FILE | Require a completed, owned upload reference; resolve key/name/size/MIME from trusted server metadata; reject text/URL payload fields initially | Shared asset input; image-specific thumbnail versus file metadata/download |

These are proposed initial rules. The schema currently allows nullable payloads and has no draft flag; use nonempty saved payloads for the first CRUD implementation rather than silently introducing drafts. The link's optional `content` is intentional. Type-specific editors can provide richer UX, but client MIME, byte count, kind, and validation results remain untrusted.

For files/images, upload bytes through dedicated upload endpoints as the coding standards recommend. The item action attaches the resulting owned upload reference; it does not accept arbitrary R2 keys. An image upload must satisfy a server-validated image allowlist, not just a client filename. Asset replacement must preserve the old file until the new item write commits, then queue old-object cleanup. Abandoned uploads need expiry cleanup. Private previews/downloads require authenticated access or short-lived authorized delivery URLs. Defer enabling FILE creation until this integration exists; metadata-only rows are not complete uploads.

Do not implement remote URL fetching merely to display a link; any future metadata extraction needs its own network-access policy. Render Markdown safely, and treat stored commands solely as copyable text.

## Refresh and related behavior

Use `revalidatePath` from the action after a successful commit for `/items`, the affected concrete type path, `/dashboard`, affected collection detail paths, the collection index, and `/profile` where usage totals change. Refresh the item layout/sidebar when type counts or collection summaries change. Invalidate both removed and added collection memberships. Take affected collection IDs from authorized database state, not arbitrary client paths. A dynamic pattern such as `/items/[type]` requires the `"page"` argument; prefer concrete paths when known. See [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath).

Start with request-scoped owner reads; do not add shared caching of private items. If owner-tagged caching is introduced later, define its keys and invalidation explicitly rather than assuming path invalidation covers every reuse. When navigation redirects are needed, revalidate before redirecting and keep redirects outside catch blocks that would swallow framework control flow. Server Actions must independently authenticate and authorize requests, as described in the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).

Favorites and pins can reuse `updateItem` with a narrow validated patch. If recently opened tracking is added, use an explicit auxiliary mutation in the same action file when a user opens a detail view, never a database write during Server Component rendering. Account for Prisma's automatic `updatedAt` behavior so recording opens does not accidentally redefine the dashboard's recently updated ordering. This behavior needs its own decision before implementation.

## Implementation verification criteria

- Each type reaches the same page and mutation modules; valid empty categories show an empty state, invalid segments show 404, and async route params are awaited.
- Direct action requests cannot read/write another user's item, type, collection, tag, or upload. Invalid related IDs leave no partial item or membership writes.
- TEXT, URL, and FILE payload rules hold even when client validation is bypassed. Links preserve optional notes, and commands never execute.
- Update conflict handling preserves newer edits. Membership removal keeps the item; deletion removes memberships but preserves shared tags/collections.
- Create/update/delete refresh cards, sidebar counts, dashboard totals, collection summaries, and profile counts as applicable.
- FILE completion includes private delivery, replacement, deletion retries, and abandoned-upload cleanup; UI-only metadata is insufficient.
- Browser verification covers all editors, create/edit/delete failures, keyboard/focus behavior, URL history, mobile layouts, and pending-state recovery. Implementation changes must pass lint, TypeScript, and production build; this documentation task does not require an application build.

## Sources and limitations

Repository sources: [project overview](../context/project-overview.md), [item types report](item-types.md), [schema](../prisma/schema.prisma), [seed](../prisma/seed.ts), [item queries](../src/lib/db/items.ts), [collection queries](../src/lib/db/collections.ts), [profile action pattern](../src/actions/profile.ts), [current user](../src/lib/current-user.ts), [dashboard layout](../src/app/dashboard/layout.tsx), [sidebar](../src/components/dashboard/DashboardSidebar.tsx), [item card](../src/components/dashboard/ItemCard.tsx), [proxy](../src/proxy.ts), and [Next configuration](../next.config.ts).

The prompt references `docs/content-types.md` and `src/lib/constants.tsx`; neither exists in this checkout. `docs/item-types.md`, the seed, and dashboard mappings supply the relevant evidence instead. Installed Next.js guides for dynamic routes, Server Actions, and revalidation were read and cross-checked through Context7 against the official Next.js documentation linked above. No database changes, live asset operations, branches, commits, or application source changes were made.
