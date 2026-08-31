"use client";

import { createContext, useContext, type ReactNode } from "react";
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

export function useT(): (key: UiStringKey) => string {
  return makeT(useContext(LocaleCtx));
}
