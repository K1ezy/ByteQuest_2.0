// Mirrors backend USERNAME_RE after its lower-casing normalisation.
export const isValidHandle = (value: string) => /^[a-z]{3,44}$/i.test(value.trim());

// A valid handle built from the display name; empty when the name has too few letters.
export function suggestHandle(name: string | null | undefined): string {
  const letters = (name ?? "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 44);
  return letters.length >= 3 ? letters : "";
}
