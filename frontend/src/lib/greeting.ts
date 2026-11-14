export function facultyGreeting(username: string, now: Date): string {
  const hour = now.getHours();
  const period = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "evening";
  const name = username ? username[0].toUpperCase() + username.slice(1) : "faculty";
  return `Good ${period}, ${name}!`;
}
