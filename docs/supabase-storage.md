# Supabase Storage setup

This integration uses only `@supabase/storage-js` in `src/lib/supabase-storage.ts`.
Neon/Prisma and Auth.js remain the application's database and authentication.
The helper lazily validates configuration and constructs a privileged server
client. Upload, finalization, private preview/download, and retryable removal are
implemented through Auth.js owner checks and the Neon storage ledger.

## Dashboard setup

1. Create or select a Supabase project. Choose a region near the Vercel server
   region. Supabase provisions its own internal database for services including
   Storage metadata; do not migrate application data or connect Prisma to it.
2. In **Storage**, create a regular file bucket named `dev-stash` (or choose your
   own name). Leave **Public bucket** disabled.
3. Set the bucket maximum to exactly 10,485,760 bytes and the supported MIME
   allowlist. Run `node --conditions=react-server --import tsx script/configure-storage.ts`
   to inspect settings or add `--apply` to configure them. The helper reads `.env`;
   add Node's `--env-file=.env.local` when these values are in `.env.local`.
4. Do not add anonymous/public access policies. Server secret keys bypass RLS;
   application operations enforce Auth.js authentication and ownership
   before calling Storage. No Supabase Auth providers or users are needed.
5. Copy the project URL from the project's **Connect** dialog (also available in
   project API settings). In **Settings > API Keys**, create/copy a **Secret key**
   beginning with `sb_secret_`. This helper expects the current secret key format,
   not an anon, publishable, database password, or legacy service-role key.

## Environment

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | HTTPS project origin, e.g. `https://<project-ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Dashboard secret key (`sb_secret_...`) |
| `SUPABASE_STORAGE_BUCKET` | Exact bucket name, e.g. `devstash` |
| `CRON_SECRET` | Random server-only bearer secret for the cleanup scheduler |

Add these to the existing root `.env.local` without replacing its other values.
Never commit that file or expose the key through `NEXT_PUBLIC_`, browser code,
logs, or API responses. No database URL changes are required.

For Vercel, add the same names in **Project Settings > Environment Variables**
for the environments that need Storage. Prefer separate Supabase projects for
production and development/preview. Restart local development after editing
environment variables; redeploy Vercel for new values to take effect. This uses
HTTPS requests and needs no local persistent disk or Supabase SSR/auth package.
Use Node.js 22 or 24 in Vercel; the installed Storage SDK requires Node.js 22+.

## Upload and cleanup lifecycle

`POST /api/uploads` accepts same-origin authenticated JSON requests. `begin`
validates the file intent, throttles the owner, checks bucket configuration, and
persists a `StorageObject` record before issuing a non-overwriting signed upload
URL. The URL lasts two hours (Supabase's fixed duration). The browser sends file
bytes directly to Storage using XMLHttpRequest with progress reporting; no
Supabase SDK or credentials are included in the browser bundle.

`finish` locks the owner and ledger row, downloads at most the declared size
(5 MiB for images, 10 MiB for files), checks the Storage MIME and actual bytes,
then creates the item and attaches the ledger record in one Prisma transaction.
Binary signatures, UTF-8 validity, and JSON/YAML/XML/TOML syntax are checked.
Text, Markdown, CSV and INI are treated as UTF-8 text. MIME aliases include
`text/plain` for text formats, `application/yaml` for YAML, and
`application/vnd.ms-excel` for CSV; the browser uploads using canonical MIME
types from `src/lib/upload-validation.ts`. XML entities/DTDs are rejected.
SVG is never previewed or inserted into the DOM.

Finalization retries return the existing item. Failure queues cleanup and
attempts immediate removal; cleanup failures retain their record. Abandonment
queues removal, and pending intents expire after two hours plus ten minutes.
All cleanup records remain durable even after the owner account is gone.

Item deletion atomically queues cleanup and removes the owned item, then tries
to remove its object. Account deletion locks the same owner used by uploads,
queues all attached and pending objects, and only then cascades database data.
Legacy file keys without ledger records block deletion until repaired, preserving
their only storage reference. Physical account cleanup runs through the worker.
The existing bulk user maintenance script also queues storage before cascading;
its preview/explicit-execution behavior is unchanged.
Database functions remain in `src/lib/db/items.ts`.

The worker locks due rows with `FOR UPDATE SKIP LOCKED`, removes up to 20 objects
per invocation, retries failures after five minutes, and retains successful
cleanup tombstones for daily re-sweeping. This accounts for replayed or in-flight
signed uploads after early deletion. It never discards the only cleanup record.
Monitor ledger `lastError`, `attempts`, and overdue `retryAt`; tombstones increase
worker demand as usage grows, so increase scheduling frequency before launch.

`vercel.json` schedules `/api/storage-cleanup` daily at 03:00 UTC. Set
`CRON_SECRET` in Vercel before deployment; Vercel sends the bearer automatically.
For faster recovery/backlogs, schedule more frequent authenticated invocations
on a suitable hosting plan. Locally or operationally, run
`node --conditions=react-server --import tsx script/cleanup-storage.ts` repeatedly
until due work is drained. No secrets or object keys are printed by these tools.

`GET /api/items/[id]/download` authorizes the owner and streams Storage's response
without buffering. Downloads use encoded attachment filenames, `nosniff`, CSP
sandboxing, and `private, no-store`. Only verified PNG/JPEG/GIF/WebP metadata
permits inline previews; SVG remains an attachment. Signed read URLs stay on the
server. Deploy the additive `storage_object_lifecycle` migration before traffic.

Validation uses mocked utility, route-handler, and database tests. No E2E tests
are created or run, and production builds are skipped under the user's instruction.

References: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets),
[Storage SDK](https://github.com/supabase/supabase-js/tree/master/packages/core/storage-js).
