import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import {
  isUnsubscribeCategory,
  UNSUBSCRIBE_CATEGORIES,
  verifyUnsubscribeToken,
  type UnsubscribeCategory,
} from "@/lib/unsubscribe";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MailX, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * T-239 (audit n°3, F8) — page publique d'opposition en un clic.
 *
 * L'e-mail d'alerte prix pointe ici avec un jeton **signé** : l'utilisateur
 * n'a rien à saisir, la désinscription est immédiate et n'exige pas de session
 * (contrainte technique d'un lien dans un e-mail). Le jeton ne permet que la
 * catégorie annoncée, jamais la modification d'autre chose.
 *
 * La page accepte volontairement `GET` : c'est un lien d'e-mail. Elle est
 * `noindex` (surface privée) et ne révèle jamais si un compte existe
 * (jeton invalide → même message générique, sans confirmation d'existence).
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return { title: t("unsub.pageTitle"), robots: { index: false, follow: false } };
}

type Outcome = "done" | "already" | "invalid";

async function unsubscribe(
  userId: string | null,
  category: string | null,
  signature: string | null,
): Promise<Outcome> {
  if (!userId || !isUnsubscribeCategory(category)) return "invalid";
  if (!verifyUnsubscribeToken(userId, category, signature)) return "invalid";

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return "invalid";

  if (category === "price_alerts") {
    if (!user.priceAlertEnabled) return "already";
    await db
      .update(users)
      .set({ priceAlertEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  return "done";
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; c?: string; s?: string }>;
}) {
  const { u, c, s } = await searchParams;
  const t = makeT(await getServerLocale());
  const outcome = await unsubscribe(u ?? null, c ?? null, s ?? null);

  const content = {
    done: {
      icon: <CheckCircle2 className="w-6 h-6 text-green-600" />,
      title: t("unsub.doneTitle"),
      body: t("unsub.doneBody"),
    },
    already: {
      icon: <CheckCircle2 className="w-6 h-6 text-green-600" />,
      title: t("unsub.alreadyTitle"),
      body: t("unsub.alreadyBody"),
    },
    invalid: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      title: t("unsub.invalidTitle"),
      body: t("unsub.invalidBody"),
    },
  }[outcome];

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MailX className="w-5 h-5 text-[#1B3A6B]" aria-hidden="true" />
            <CardTitle>{t("unsub.pageTitle")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            {content.icon}
            <div>
              <p className="font-medium text-gray-900">{content.title}</p>
              <p className="text-sm text-gray-600 mt-1">{content.body}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {t("unsub.manageHint")}{" "}
            <Link href="/mon-compte" className="text-[#1B3A6B] underline">
              {t("unsub.accountLink")}
            </Link>
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("unsub.backHome")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

/** Catégories acceptées par la page (garde de test : liste centralisée). */
export const SUPPORTED_CATEGORIES: readonly UnsubscribeCategory[] = UNSUBSCRIBE_CATEGORIES;
