"use client";

import { Paperclip } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

/** Lien vers le handler qui vérifie le participant avant de servir le fichier. */
export function MessageAttachment({ messageId, legacyUrl }: { messageId: string; legacyUrl?: string | null }) {
  const t = useT();
  if (legacyUrl) {
    return <p className="mt-2 text-xs text-amber-700">{t("msg.legacyAttach")}</p>;
  }
  return (
    <a href={`/api/messages/attachments/${messageId}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline opacity-90 hover:opacity-100">
<Paperclip className="w-3 h-3" /> {t("msg.openAttach")}
    </a>
  );
}
