export function timeGreeting(name: string, now: Date): string {
  const hour = now.getHours();
  const period = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening";
  return name ? `Good ${period}, ${name[0].toUpperCase() + name.slice(1)}!` : `Good ${period}!`;
}
