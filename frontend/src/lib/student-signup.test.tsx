import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ checkUsernameAvailability: mocks.check }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { signUp: mocks.signUp } }) }));

import { signUpStudent } from "./student-signup";

const registration = { schoolId: " 00123 ", yearLevel: 3, blockSection: "F" };

afterEach(() => vi.clearAllMocks());

it("saves the normalized public username with signup for immediate and email-confirmed sessions", async () => {
  mocks.check.mockResolvedValue(true);
  for (const session of [{ access_token: "test" }, null]) {
    mocks.signUp.mockResolvedValue({ data: { session }, error: null });
    const result = await signUpStudent(" learner@example.test ", "password", "  AdaHandle  ", registration);
    expect(result.data.session).toBe(session);
    expect(mocks.check).toHaveBeenCalledWith("adahandle");
    expect(mocks.signUp).toHaveBeenLastCalledWith({
      email: "learner@example.test", password: "password",
      options: { data: { username: "adahandle", school_id: "00123", year_level: 3, block_section: "F" } },
    });
  }
});

it("rejects invalid or unavailable names before creating an Auth user", async () => {
  await expect(signUpStudent("learner@example.test", "password", "name123", registration)).rejects.toThrow("3–44 letters");
  mocks.check.mockResolvedValue(false);
  await expect(signUpStudent("learner@example.test", "password", "TakenName", registration)).rejects.toThrow("already taken");
  expect(mocks.signUp).not.toHaveBeenCalled();
});

it("reports a signup race while allowing a different username retry", async () => {
  mocks.check.mockResolvedValue(true);
  mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: { message: "Database error saving new user" } })
    .mockResolvedValueOnce({ data: { session: null }, error: null });
  await expect(signUpStudent("learner@example.test", "password", "firsthandle", registration)).rejects.toThrow("may have just been taken");
  await expect(signUpStudent("learner@example.test", "password", "secondhandle", registration)).resolves.toHaveProperty("data.session", null);
});
