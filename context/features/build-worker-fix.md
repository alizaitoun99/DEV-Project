# CSS build worker fix

## Problem

Next.js 16.4.2 with Node.js 24.15.0 repeatedly fails while evaluating the Tailwind CSS Turbopack loader. The helper Node process exits with code 0 before Turbopack establishes its communication connection. The error occurs in both sandboxed and unsandboxed production builds.

The trace identifies worker startup/communication failure, rather than a reported CSS syntax error. The exact OS/runtime trigger remains unconfirmed; do not attribute it to OneDrive, antivirus, or the application code without further evidence.

## Resolution

Use Next.js's supported Webpack bundler for development and production, with the official Tailwind v4 PostCSS plugin. Replace the Turbopack-only Tailwind loader and its custom CSS rule with postcss.config.mjs. Keep Tailwind configuration in globals.css.

This avoids the failing Turbopack worker path; it is a compatibility workaround, not a patch to Turbopack itself. No Next.js or Node downgrade is required.

Do not force Turbopack worker threads on this runtime: the installed Next.js documentation warns of a native-addon teardown issue on Node 24.13.1 and newer.

## Additional build issue

After CSS compilation succeeded, prerender validation exposed the new database sidebar accessing connection() outside Suspense. Wrap the sidebar in a Suspense boundary in the dashboard layout; keep Cache Components enabled.

## Validation

- `npm run build`: passed, including CSS compilation, TypeScript, static generation and build traces.
- `npm run lint`: passed without warnings after fixing the PostCSS export.
- `git diff --check`: passed.
- Generated production CSS is present in `.next/static/css/`.
