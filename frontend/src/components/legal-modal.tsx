"use client";

import { useEffect, useRef } from "react";
import { LegalDocument, type LegalKind } from "./legal-document";

export function LegalModal({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return <dialog
    ref={dialogRef}
    className="legal-dialog"
    aria-label={kind === "terms" ? "ByteQuest Terms of Service" : "ByteQuest Privacy Policy"}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
  >
    <div className="legal-dialog-inner">
      <button type="button" className="legal-dialog-close" onClick={onClose} aria-label="Close legal document" autoFocus>×</button>
      <LegalDocument kind={kind} />
    </div>
  </dialog>;
}
