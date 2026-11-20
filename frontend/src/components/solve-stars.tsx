// Mirrors backend app/services/gamification/solve_quality.py. Stars are informational:
// they describe how a challenge was solved and never change XP.
export const MAX_STARS = 3;
export const STAR_MEANING: Record<number, string> = {
  1: "Solved",
  2: "Solved without hints",
  3: "Solved without hints in 2 attempts or fewer",
};
export const STAR_GUIDE = "1 star: solved · 2 stars: no hints used · 3 stars: no hints, within 2 attempts";

export function SolveStars({ stars, className = "" }: { stars: number; className?: string }) {
  const earned = Math.max(0, Math.min(MAX_STARS, Math.round(stars)));
  const label = `${earned} of ${MAX_STARS} stars: ${STAR_MEANING[earned] ?? "Not solved yet"}`;
  return (
    <span className={`solve-stars ${className}`.trim()} role="img" aria-label={label} data-tooltip={`${label}. ${STAR_GUIDE}.`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <span key={index} className={index < earned ? "is-earned" : undefined} aria-hidden="true">★</span>
      ))}
    </span>
  );
}
