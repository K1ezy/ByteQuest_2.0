import { checkUsernameAvailability } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export async function signUpStudent(email: string, password: string, username: string, registration: {
  schoolId: string;
  yearLevel: number;
  blockSection: string;
  role?: "student" | "instructor";
}) {
  const chosenUsername = username.trim().toLowerCase();
  if (!/^[a-z]{3,44}$/.test(chosenUsername)) {
    throw new Error("Username must be 3–44 letters, without spaces or numbers.");
  }
  const schoolId = registration.schoolId.trim();
  if (!schoolId || schoolId.length > 64) throw new Error("Enter a School ID of 1–64 characters.");
  const isStudent = !registration.role || registration.role === "student";
  if (isStudent && (![1, 2, 3, 4].includes(registration.yearLevel) || !/^[A-F]$/.test(registration.blockSection))) {
    throw new Error("Choose your year level and block section.");
  }
  if (!(await checkUsernameAvailability(chosenUsername))) {
    throw new Error("That username is already taken. Choose another one.");
  }
  const result = await getSupabase().auth.signUp({
    email: email.trim(), password, options: { data: {
      username: chosenUsername, school_id: schoolId,
      ...(isStudent ? { year_level: registration.yearLevel, block_section: registration.blockSection }
        : { registration_role: registration.role }),
    } },
  });
  if (result.error) {
    if (/database error saving new user|duplicate key|username/i.test(result.error.message)) {
      throw new Error("Account could not be created. The username may have just been taken; choose another and try again.");
    }
    throw result.error;
  }
  return result;
}
