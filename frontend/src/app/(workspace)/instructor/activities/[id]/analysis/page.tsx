"use client";

import { useParams } from "next/navigation";
import { ActivityAnalysisView } from "@/components/instructor/activity-analysis";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ActivityAnalysisView key={id} activityId={id} />;
}
