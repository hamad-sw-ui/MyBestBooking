"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { isUiLocale, makeT, type UiLocale, type UiStringKey } from "@/lib/ui-strings";

const LocaleCtx = createContext<UiLocale>("fr");

/**
 * T-167 — locale UI côté client, amorcée par la locale serveur pour éviter
 * le flash français au SSR (`useDisplayPreferences` démarre à `null`).
 */
export function UiLocaleProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: UiLocale;
  children: ReactNode;
}) {
  const { language, ready } = useDisplayPreferences();
  const loc: UiLocale = ready && isUiLocale(language) ? language : initialLanguage;
  return <LocaleCtx.Provider value={loc}>{children}</LocaleCtx.Provider>;
}

export function useUiLocale(): UiLocale {
  return useContext(LocaleCtx);
}

/**
 * T-189 — `t` est désormais STABLE entre deux renders tant que la locale
 * ne change pas (useMemo). Cela rend possible son inscription dans les
 * dépendances des useEffect/useMemo sans boucle (auparavant : identité
 * nouvelle à chaque render → re-run à chaque render si listée). Un
 * changement de langue re-déclenche correctement les effets dépendants.
 */
export function useT(): (key: UiStringKey) => string {
  const locale = useContext(LocaleCtx);
  return useMemo(() => makeT(locale), [locale]);
}
