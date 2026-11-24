import { checkSchoolIdAvailability, checkUsernameAvailability } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { isStudentSchoolId, STUDENT_SCHOOL_ID_ERROR } from "@/lib/school-id";

export const SCHOOL_ID_TAKEN_ERROR = "This School ID is already registered to an account. If it’s yours, sign in instead. Otherwise, check the ID with your instructor.";
const USERNAME_TAKEN_ERROR = "That username is already taken. Choose another one.";

type Registration = {
  schoolId: string;
  yearLevel: number;
  blockSection: string;
  role?: "student" | "instructor";
  /** The optional research answer from the sign-up Terms step; students only. */
  research?: boolean;
};

function validatedSignup(email: string, password: string, username: string, registration: Registration) {
  const chosenUsername = username.trim().toLowerCase();
  if (!/^[a-z]{3,44}$/.test(chosenUsername)) {
    throw new Error("Username must be 3–44 letters, without spaces or numbers.");
  }
  const trimmedEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 320) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
  const schoolId = registration.schoolId.trim();
  const isStudent = !registration.role || registration.role === "student";
  if (isStudent && !isStudentSchoolId(schoolId)) throw new Error(STUDENT_SCHOOL_ID_ERROR);
  if (!isStudent && (!schoolId || schoolId.length > 64)) throw new Error("Enter a School ID of 1–64 characters.");
  if (isStudent && (![1, 2, 3, 4].includes(registration.yearLevel) || !/^[A-F]$/.test(registration.blockSection))) {
    throw new Error("Choose your year level and block section.");
  }
  return { email: trimmedEmail, username: chosenUsername, schoolId, isStudent };
}

/** Every check that can fail sign-up, run before the Terms step. The signup trigger stays authoritative. */
export async function checkStudentSignup(email: string, password: string, username: string, registration: Registration) {
  const fields = validatedSignup(email, password, username, registration);
  if (!(await checkUsernameAvailability(fields.username))) throw new Error(USERNAME_TAKEN_ERROR);
  if (fields.isStudent && !(await checkSchoolIdAvailability(fields.schoolId))) throw new Error(SCHOOL_ID_TAKEN_ERROR);
}

export async function signUpStudent(email: string, password: string, username: string, registration: Registration) {
  const fields = validatedSignup(email, password, username, registration);
  if (!(await checkUsernameAvailability(fields.username))) throw new Error(USERNAME_TAKEN_ERROR);
  const result = await getSupabase().auth.signUp({
    email: fields.email, password, options: { data: {
      username: fields.username, school_id: fields.schoolId,
      ...(fields.isStudent ? { year_level: registration.yearLevel, block_section: registration.blockSection,
        research_consent: registration.research ? "accepted" : "declined" }
        : { registration_role: registration.role }),
    } },
  });
  if (result.error) {
    if (fields.isStudent && /database error saving new user|duplicate key/i.test(result.error.message)) {
      throw new Error("Account could not be created. Your School ID or username may have just been registered by someone else. Check both and try again.");
    }
    if (/database error saving new user|duplicate key|username/i.test(result.error.message)) {
      throw new Error("Account could not be created. The username may have just been taken; choose another and try again.");
    }
    throw result.error;
  }
  return result;
}
