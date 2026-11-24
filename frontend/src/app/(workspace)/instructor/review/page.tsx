import { redirect } from "next/navigation";

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const previous = await searchParams;
  const review = typeof previous.status === "string" ? previous.status : "open";
  const next = new URLSearchParams({ review });
  if (review !== "published" && review !== "all") next.set("status", "draft");
  for (const key of ["course", "material", "from", "to", "q"]) {
    if (typeof previous[key] === "string") next.set(key, previous[key]);
  }
  redirect(`/instructor/activities?${next}`);
}
