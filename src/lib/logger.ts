/**
 * T-028 — Logger structuré (JSON one-liner).
 *
 * Design minimaliste : produit une ligne JSON par événement, écrite
 * sur stdout (info/debug) ou stderr (warn/error). Compatible avec
 * la plupart des collecteurs (Vercel, Grafana Loki, Datadog, GCP).
 *
 * Ne remplace pas `console.*` pour l'existant (rétro-compat) mais
 * fournit une API canonique pour les nouveaux modules.
 */

type Level = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  level: Level;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

function emit(level: Level, msg: string, extra?: Record<string, unknown>) {
  const evt: LogEvent = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(extra ?? {}),
  };
  const line = JSON.stringify(evt);
  if (level === "error" || level === "warn") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
};

/** Sanitize helper : retire les clés sensibles (password, secret, token). */
export function safeMeta(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (/pass|secret|token|api[_-]?key/i.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}
