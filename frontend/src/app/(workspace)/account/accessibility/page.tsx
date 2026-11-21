"use client";

import { AccessibilitySettings } from "@/components/accessibility-settings";
import { useShellProfile } from "@/components/app-shell";

// Direct links still open the full page; the account menu shows the same settings as a dialog.
export default function AccessibilityPage() {
  return <AccessibilitySettings ownerId={useShellProfile().id} />;
}
