# Custom authentication UI

## Problem
The default authentication screens do not match DevStash or expose its registration flow.

## Requirements
Support credentials and GitHub, preserve callback destinations and existing throttling, show registration errors, and provide account navigation and sign-out.

## Alternatives
Server Actions for authentication, or the installed Auth.js client helpers with the existing registration endpoint.

## Decision & Why
Use Auth.js client helpers for sign-in and sign-out, retaining their CSRF handling and inline error results. Registration uses the existing endpoint and shared Zod schema. Configure the shared auth sign-in page and proxy redirects consistently. Accept only local callback paths in the UI.

After registration, authenticate through the existing credentials provider before navigating to the dashboard. If that separate request fails, retain the created account and direct the user to sign in. Mount one Sonner toaster in the root layout with a 3000ms duration. Use client navigation and refresh authenticated server data so success toasts remain visible after route changes. Retain inline form errors alongside error toasts.

## Trade-offs
Forms require JavaScript. The avatar opens an accessible Radix menu containing a separate Profile link, resolving the specification's overlapping click behavior. Follow the sidebar placement requirement. The profile destination is a minimal protected read-only page.

## Implementation & Testing
Small client form, avatar, and menu components sit within server-rendered pages. The server reads profile details for the authenticated user, including the image. Validate with lint, TypeScript, the production build, auth security regression checks, and browser flows when browser access is available. No database migration is required.
