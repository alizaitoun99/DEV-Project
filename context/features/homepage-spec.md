# Homepage Spec

## Overview

Build the public DevStash homepage at `/` in `src/app/page.tsx`. Use the [updated homepage prototype](../../prototypes/homepage/index.html) as the design reference and the [mockup spec](homepage-mockup-spec.md) for design details.

## Requirements

- Recreate the navigation, chaos-to-order hero, Features grid, AI preview, pricing comparison, closing CTA, and footer. Preserve the responsive layouts and stack the hero panels on mobile.
- Carry over the larger floating icons and gentler cursor response, the Library, Pinned, and Recently saved labels, and the sample pinned snippet. Keep the dashboard preview static and use sample data.
- Give Features a slightly lighter full-width background. Use Snippets blue (`#3b82f6`) for primary buttons and lighter blue shades for accent text. Preserve the mockup’s item type accents.
- Keep the AI preview and pricing comparison as demonstrations. The monthly/yearly toggle updates the displayed price and billing copy. Keep displayed product and plan claims aligned with the current offering.

## Implementation

- Keep `src/app/page.tsx` and static sections as Server Components. Use small Client Components for the floating icons, pricing toggle, and scroll behavior that needs browser APIs. Honor reduced-motion preferences and pause icon animation when the panel is offscreen or the tab is hidden.
- Use Tailwind utilities and existing shadcn/ui primitives, including Button, as appropriate. Reuse the existing font and theme setup. Keep repeated cards and links data-driven where it improves readability.
- Use semantic landmarks and headings, a skip link, visible keyboard focus, and accessible pressed states for the pricing toggle. Keep decorative elements out of the accessibility tree.

## Link Destinations

| Control | Destination |
| --- | --- |
| Brand | `/` |
| Sign in | `/sign-in` |
| Get started and registration CTAs | `/register` |
| See how it works and Take a look | `#preview` |
| Features, Pricing, and AI powers | `#features`, `#pricing`, and `#ai` |
| AI section CTA | `#pricing` |
| Skip to content | `#main` |

Use Next.js Link for app routes and native anchors for same-page links. Label pricing CTAs according to the action they perform. Registration CTAs lead to account creation. Checkout is outside this feature.

## Acceptance Checks

- Verify the public page at `/` and each link destination. Check desktop and mobile layouts for overflow and ensure the fixed nav clears anchor targets.
- Verify keyboard navigation, both pricing states, cursor response, and reduced-motion behavior.
- Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
