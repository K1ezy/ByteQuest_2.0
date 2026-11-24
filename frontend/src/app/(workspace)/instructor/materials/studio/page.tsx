import { redirect } from "next/navigation";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const old = await searchParams;
  const query = new URLSearchParams({ method: "gemini" });
  for (const field of ["document", "course"]) {
    if (typeof old[field] === "string") query.set(field, old[field]);
  }
  redirect(`/instructor/activities/new?${query}`);
}
