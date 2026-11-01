# DevStash

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links and custom type

## Context file

Read the following to get the full context of the project;

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Project Structure & Module Organization

Devstash uses Next.js App Router, React, TypeScript, and Tailwind CSS. Application code lives in `src/app/`: `page.tsx` defines the home page, `layout.tsx` provides the root layout and metadata, and `globals.css` imports Tailwind and holds global styles. Place static assets in `public/`. Root configuration includes `next.config.ts`, `tsconfig.json`, and `eslint.config.mjs`. Treat `.next/` as generated output.

## Build, Test, and Development Commands

Use npm and keep `package-lock.json` synchronized with dependency changes.

- `npm ci`: install dependencies from the lockfile.
- `npm run dev`: start the local development server at `http://localhost:3000`.
- `npm run build`: create the production build.
- `npm start`: serve the production build after building.
- `npm test`: run Vitest unit tests once.
- `npm run test:watch`: watch unit tests during development.
- `npm run lint`: run the configured ESLint checks.
- `npx tsc --noEmit`: check TypeScript without emitting JavaScript.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, and semicolons in TypeScript, matching existing configuration files. Keep TypeScript strict mode enabled. Use PascalCase for React components and camelCase for functions and variables. Follow App Router filenames such as `page.tsx` and `layout.tsx`; use the `@/*` alias for imports from `src/`. Prefer Tailwind utilities for styling. ESLint is configured for Next.js Core Web Vitals and TypeScript; no formatter is configured.

## Testing Guidelines

Use Vitest in Node for Server Actions and utilities only; no component unit tests. Colocate `*.test.ts` files under `src/actions/` or `src/lib/`. Mock external services and request context so unit tests need no credentials or live database. Run `npm test`, lint, type checking, and the production build; manually verify affected routes and responsive layouts for UI changes. Existing Node regression scripts remain separate. No coverage threshold is configured. Report skipped or failing checks explicitly. See [Testing](docs/testing.md).

## Commit & Pull Request Guidelines

History contains only `Initial commit from Create Next App`, so no commit convention is established. Write concise, imperative subjects such as `Add resource search`. Keep changes focused. PRs should describe behavior, link relevant issues, list validation results, and include screenshots for visible UI changes. Never commit secrets or `.env*` files.

## Agent-Specific Instructions

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
