import { redirect } from "next/navigation";
import { activityEditorHref } from "@/lib/instructor-activity";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const [{ id }, { course }] = await Promise.all([params, searchParams]);
  redirect(activityEditorHref(id, typeof course === "string" ? course : null));
}
