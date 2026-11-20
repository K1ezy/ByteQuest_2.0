"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/workspace/ui";
import { getErrorMessage } from "@/lib/api";

export function SaveConflict({ changes, onReload }: { changes: object; onReload: () => void | Promise<void> }) {
  const [copyStatus, setCopyStatus] = useState<"copied" | "manual" | "">("");
  const [reloadError, setReloadError] = useState("");
  const [reloading, setReloading] = useState(false);
  const text = JSON.stringify(changes, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("manual");
    }
  }

  async function reload() {
    setReloadError("");
    setReloading(true);
    try {
      await onReload();
    } catch (error) {
      setReloadError(getErrorMessage(error));
    } finally {
      setReloading(false);
    }
  }

  return (
    <Notice tone="error">
      <p>This was changed somewhere else. Copy your unsaved changes before reloading to keep a copy.</p>
      <div className="ws-inline-actions">
        <Button variant="outline" onClick={() => void copy()}>Copy my unsaved changes</Button>
        <Button variant="outline" disabled={reloading} onClick={() => void reload()}>Reload saved version</Button>
      </div>
      {copyStatus === "copied" ? <p role="status">Unsaved changes copied.</p> : null}
      {copyStatus === "manual" ? (
        <textarea aria-label="Unsaved changes to copy" readOnly rows={5} value={text} onFocus={(event) => event.currentTarget.select()} />
      ) : null}
      {reloadError ? <p role="status">Could not reload the saved version. {reloadError}</p> : null}
    </Notice>
  );
}
