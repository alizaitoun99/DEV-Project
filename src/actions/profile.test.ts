import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { changePasswordForUser, deleteAccountForUser } from "@/lib/profile-account";
import { changePassword, deleteAccount } from "@/actions/profile";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profile-account", () => ({
  changePasswordForUser: vi.fn(),
  deleteAccountForUser: vi.fn(),
}));

// Auth.js overloads auth for middleware too; these actions use its no-argument form.
const mockAuth = vi.mocked(auth as () => Promise<{ user: { id?: string } } | null>);

beforeEach(() => {
  vi.resetAllMocks();
});

describe.each([
  { name: "changePassword", action: changePassword, service: changePasswordForUser },
  { name: "deleteAccount", action: deleteAccount, service: deleteAccountForUser },
])("$name", ({ action, service }) => {
  it.each([null, { user: {} }])("rejects sessions without a user ID: %j", async (session) => {
    mockAuth.mockResolvedValue(session);

    await expect(action({})).resolves.toEqual({ success: false, error: "Please sign in again." });
    expect(changePasswordForUser).not.toHaveBeenCalled();
    expect(deleteAccountForUser).not.toHaveBeenCalled();
  });

  it("uses the session owner instead of an input user ID and returns the service result", async () => {
    mockAuth.mockResolvedValue({ user: { id: "session-owner" } });
    const input = { userId: "another-user", confirmation: "DELETE" };
    const result = { success: false as const, error: "Invalid input." };
    vi.mocked(service).mockResolvedValue(result);

    await expect(action(input)).resolves.toEqual(result);
    expect(service).toHaveBeenCalledExactlyOnceWith("session-owner", input);
  });
});
