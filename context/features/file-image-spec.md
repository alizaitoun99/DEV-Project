# File and Image Upload with Supabase Storage

## Overview

Add file and image functionality using the existing server-only Supabase Storage
client and private `dev-stash` bucket. Use Supabase only for Storage. Keep the
existing Neon/Prisma database and Auth.js authentication.

This specification describes the next implementation phase. Preparing this
document does not implement or enable file operations.

## Requirements

- Create an authenticated upload API route using `src/lib/supabase-storage.ts`.
- Keep Prisma/database functions in `src/lib/db/items.ts`.
- Create a FileUpload component with drag-and-drop, selection, validation,
  progress feedback, pending controls, and actionable errors.
- Enable file/image types in the create item modal and route-specific add buttons.
- Display image previews for images and file metadata for files.
- Store private object keys in `Item.fileKey`, plus original name, size, and MIME
  type in the existing metadata fields. Never persist public or expiring URLs.
- Add an authenticated download proxy route and ItemDrawer download button for
  both file and image items. Stream responses rather than buffering downloads.
- Remove stored objects when their items are deleted. Extend the existing
  deletion guard only once storage cleanup is implemented safely.
- Handle cross-service failures explicitly: if database persistence fails after
  upload, clean up the uploaded object. Failed cleanup must remain discoverable
  and retryable; never silently orphan objects or remove the only cleanup record.
- Define deletion sequencing and recovery before enabling stored-item deletion;
  Supabase and Prisma cannot share an atomic transaction. Include account deletion
  in the storage lifecycle so cascading item deletion cannot orphan objects.

## Security and architecture

- Keep all Supabase credentials and SDK usage server-only. Use the existing
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_STORAGE_BUCKET` variables.
- The secret key bypasses Storage RLS. Authenticate through Auth.js and verify
  ownership through Prisma for every upload, preview, download, and delete.
- Generate unique server-controlled object keys scoped to the authenticated user;
  never accept arbitrary object keys or user IDs as authorization.
- Use a private bucket without anonymous/public policies. Do not add Supabase
  Auth, Database clients, database URLs, or R2/S3 credentials.
- Validate size, extension, and content type on the server as well as the client.
  Do not trust the browser MIME label or filename alone. Treat text-format MIME
  variations explicitly; reject mismatches and unsupported formats.
- Serve downloads as attachments with safely encoded filenames and
  `X-Content-Type-Options: nosniff`. Keep private responses non-cacheable.
- SVG is supported as an uploaded file, but must not render as active markup on
  the application origin. Use a safe preview strategy or a placeholder; never
  inject uploaded SVG into the DOM.
- Revoke local object URLs when previews are replaced or unmounted.

## Vercel compatibility

Vercel Functions impose request-body limits below the 10 MB file requirement.
Do not proxy full uploads through a function. The authenticated upload route
should validate upload intent and issue a short-lived, object-scoped signed
upload URL. The browser uploads directly to Supabase with progress reporting;
the secret key never leaves the server. Finalization must verify the uploaded
object and its ownership, size, and accepted format before creating the item.
Enforce type-specific limits server-side and clean up rejected/abandoned uploads.
Verify current platform and SDK limits before implementation.

## File constraints

Use binary size limits: 5 MB = 5 × 1024 × 1024 bytes; 10 MB = 10 × 1024 × 1024 bytes.

| Type | Max size | Extensions |
| --- | --- | --- |
| Images | 5 MB | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` |
| Files | 10 MB | `.pdf`, `.txt`, `.md`, `.json`, `.yaml`, `.yml`, `.xml`, `.csv`, `.toml`, `.ini` |

## MIME types

Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`.

Files: `application/pdf`, `text/plain`, `text/markdown`, `application/json`,
`application/x-yaml`, `text/yaml`, `application/xml`, `text/xml`, `text/csv`,
`application/toml`. INI files use `text/plain`. Explicitly document additional
safe MIME aliases needed by the chosen upload flow.

Configure the shared private bucket with a 10 MB maximum and the supported MIME
allowlist. The application must separately enforce the 5 MB image maximum.
The last connection check confirmed the bucket is private, with no bucket-level
size or MIME restrictions configured yet.

## Validation

- Add meaningful mocked utility/Server Action tests for authorization, ownership,
  constraints, upload finalization, and cleanup failure paths.
- Run unit tests, lint, and TypeScript checks. Do not run production builds under
  the current user instruction.
- Manually verify create, preview, download, deletion, failure feedback, progress,
  keyboard interaction, and responsive layouts when implementation is authorized.
