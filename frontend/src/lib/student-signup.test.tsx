import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  schoolId: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ checkUsernameAvailability: mocks.check, checkSchoolIdAvailability: mocks.schoolId }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { signUp: mocks.signUp } }) }));

import { checkStudentSignup, SCHOOL_ID_TAKEN_ERROR, signUpStudent } from "./student-signup";

const registration = { schoolId: " 26-00123 ", yearLevel: 3, blockSection: "F" };

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
      options: { data: { username: "adahandle", school_id: "26-00123", year_level: 3, block_section: "F",
        research_consent: "declined" } },
    });
  }
});

it("carries the optional sign-up research answer for students only", async () => {
  mocks.check.mockResolvedValue(true);
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await signUpStudent("learner@example.test", "password", "adahandle", { ...registration, research: true });
  expect(mocks.signUp.mock.lastCall?.[0].options.data.research_consent).toBe("accepted");
  await signUpStudent("staff@example.test", "password", "staffhandle",
    { schoolId: "T-1", yearLevel: 0, blockSection: "", role: "instructor", research: true });
  expect(mocks.signUp.mock.lastCall?.[0].options.data).not.toHaveProperty("research_consent");
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
  await expect(signUpStudent("learner@example.test", "password", "firsthandle", registration)).rejects.toThrow("may have just been registered");
  await expect(signUpStudent("learner@example.test", "password", "secondhandle", registration)).resolves.toHaveProperty("data.session", null);
});

it("checks every credential before the Terms step, including an already-used School ID", async () => {
  for (const [email, password, schoolId, message] of [
    ["not-an-email", "password", "26-00123", "valid email"],
    ["learner@example.test", "short", "26-00123", "at least 8 characters"],
    ["learner@example.test", "password", "26-00000", "format 26-00001"],
  ]) {
    await expect(checkStudentSignup(email, password, "AdaHandle", { ...registration, schoolId })).rejects.toThrow(message);
  }
  expect(mocks.check).not.toHaveBeenCalled();

  mocks.check.mockResolvedValue(true);
  mocks.schoolId.mockResolvedValueOnce(false);
  await expect(checkStudentSignup(" learner@example.test ", "password", "AdaHandle", registration)).rejects.toThrow(SCHOOL_ID_TAKEN_ERROR);
  expect(mocks.schoolId).toHaveBeenCalledWith("26-00123");

  mocks.schoolId.mockResolvedValueOnce(true);
  await expect(checkStudentSignup("learner@example.test", "password", "AdaHandle", registration)).resolves.toBeUndefined();
  // Staff School IDs are free-form and are not checked against student IDs.
  await expect(checkStudentSignup("staff@example.test", "password", "StaffHandle",
    { ...registration, schoolId: "T-1", role: "instructor" })).resolves.toBeUndefined();
  expect(mocks.schoolId).toHaveBeenCalledTimes(2);
  expect(mocks.signUp).not.toHaveBeenCalled();
});
