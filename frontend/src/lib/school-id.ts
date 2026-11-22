export const STUDENT_SCHOOL_ID_PATTERN = "[0-9]{2}-(?!00000)[0-9]{5}";
export const STUDENT_SCHOOL_ID_ERROR = "Enter your school-issued ID in the format 26-00001.";

export function isStudentSchoolId(value: string): boolean {
  return new RegExp(`^(?:${STUDENT_SCHOOL_ID_PATTERN})$`).test(value);
}

export function formatStudentSchoolId(value: string): string | null {
  const digits = value.replace("-", "");
  if (!/^[0-9]{0,7}$/.test(digits)) return null;
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}-${digits.slice(2)}`;
}
