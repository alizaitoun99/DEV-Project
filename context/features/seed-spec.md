# Seed Data Specification

## Overview

Create a seed script (`prisma/seed.ts`) to populate the database with sample data for development and demos.

## Requirements

### User

- **Email:** demo@devstash.io
- **Name:** John Doe
- **Password:** 12345678 (hash with bcryptjs, 12 rounds)
- **Plan:** Free
- **emailVerified:** current date

### System Item Types

| Name    | Icon       | Color   |
| ------- | ---------- | ------- |
| snippet | Code       | #3b82f6 |
| prompt  | Sparkles   | #8b5cf6 |
| command | Terminal   | #f97316 |
| note    | StickyNote | #fde047 |
| file    | File       | #6b7280 |
| image   | Image      | #ec4899 |
| link    | Link       | #10b981 |

Icons are Lucide React component names. All types have `isSystem: true`.

### Collections & Items

#### React Patterns

_Description: Reusable React patterns and hooks_

3 snippets (TypeScript):

- Custom hooks (useDebounce, useLocalStorage, etc.)
- Component patterns (Context providers, compound components)
- Utility functions

#### AI Workflows

_Description: AI prompts and workflow automations_

3 prompts:

- Code review prompts
- Documentation generation
- Refactoring assistance

#### DevOps

_Description: Infrastructure and deployment resources_

- 1 snippet (Docker, CI/CD config)
- 1 command (deployment scripts)
- 2 links (documentation URLs - use real URLs)

## Resetting the development demo

`npm run db:seed` upserts the fixture. To replace existing demo items and collections with the three collections and 10 sample items above, run `npm run db:seed -- -- --reset-demo`. The reset keeps the demo account and queues cleanup of its existing uploaded files.
- Icon libraries
