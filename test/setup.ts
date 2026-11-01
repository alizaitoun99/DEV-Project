import { vi } from "vitest";

// Next.js enforces this marker during bundling; unit tests run outside Next.js.
vi.mock("server-only", () => ({}));
