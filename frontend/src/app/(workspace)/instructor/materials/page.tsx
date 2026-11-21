"use client";

import { MaterialsManager } from "@/components/materials-manager";
import { WorkspaceSuspense } from "@/components/workspace/workspace-provider";

export default function Page() {
  return <WorkspaceSuspense label="materials"><MaterialsManager scope="faculty" /></WorkspaceSuspense>;
}
