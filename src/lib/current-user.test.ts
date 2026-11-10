import { beforeEach, expect, it, vi } from "vitest";
import { findCurrentUser, getCurrentUser } from "./current-user";

const { auth, findUnique, redirect } = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn(() => { throw new Error("Redirected"); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("next/navigation", () => ({ redirect }));

beforeEach(() => {
  auth.mockReset();
  findUnique.mockReset();
});

it("treats guests as signed out without querying the database", async () => {
  auth.mockResolvedValue(null);

  await expect(findCurrentUser()).resolves.toBeNull();
  expect(findUnique).not.toHaveBeenCalled();
});

it("treats a session for a missing user as signed out and protects the workspace", async () => {
  auth.mockResolvedValue({ user: { id: "removed-user" } });
  findUnique.mockResolvedValue(null);

  await expect(findCurrentUser()).resolves.toBeNull();
  await expect(getCurrentUser()).rejects.toThrow("Redirected");
  expect(redirect).toHaveBeenCalledWith("/sign-in?callbackUrl=%2Fdashboard");
});

it("returns the account associated with the authenticated user ID", async () => {
  const user = { id: "user-id", name: "DevStash user" };
  auth.mockResolvedValue({ user: { id: user.id } });
  findUnique.mockResolvedValue(user);

  await expect(getCurrentUser()).resolves.toEqual(user);
  expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id } }));
});
