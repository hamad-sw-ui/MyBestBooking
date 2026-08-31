"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

export function CreateWishlistButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/wishlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isPublic }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t("wish.createFail"));
      setOpen(false);
      setName("");
      router.refresh();
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : t("settings.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> {t("wish.newList")}</Button>;

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg">
<label className="sr-only" htmlFor="wishlist-name">{t("wish.name")}</label>
      <input id="wishlist-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t("wish.namePlaceholder")} className="px-3 py-1.5 border border-gray-200 rounded text-sm" />
<label className="inline-flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> {t("wish.shareable")}</label>
<Button size="sm" onClick={create} disabled={!name.trim() || busy}>{busy ? t("wish.creating") : t("wish.create")}</Button>
<Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
