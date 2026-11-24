import { redirect } from "next/navigation";
import { studentExamsHref } from "@/lib/navigation";

export default function ExamsPage() {
  redirect(studentExamsHref);
}
