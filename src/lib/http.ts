import { NextResponse, type NextRequest } from "next/server";

/**
 * Lecture tolérante du corps JSON d'une requête.
 *
 * T-120 (D1) : `request.json()` lève une `SyntaxError` quand le corps est
 * vide ou mal formé. Laissée non capturée, elle transformait une simple
 * erreur de requête en erreur serveur **500** (bruit de monitoring, contrat
 * HTTP incorrect). Ce helper renvoie `null` dans ce cas pour que la route
 * puisse répondre proprement **400** ; Zod continue de valider les champs.
 *
 * Aucun changement de comportement pour les appels qui envoient un JSON
 * valide : la valeur parsée est restituée telle quelle.
 */
export async function readJsonBody(request: NextRequest | Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Vrai si la valeur lue est un objet JSON utilisable (non null, non tableau
 * primitif). Utilisé pour rejeter tôt les corps absidents avant Zod.
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Réponse 400 standard pour un corps de requête absent ou illisible. */
export function invalidBodyResponse(message = "Corps de requête invalide ou manquant") {
  return {
    body: { error: message },
    init: { status: 400 } as const,
  };
}

/**
 * T-122 (G1) : vrai si la valeur est un UUID syntaxiquement valide. Léger
 * (regex) pour être utilisable dans n'importe quel runtime, y compris le
 * proxy edge.
 *
 * Sans ce garde-fou, un identifiant issu d'une route dynamique (ex.
 * `/api/rooms/abc`) était passé tel quel à une comparaison Drizzle sur une
 * colonne `uuid` : Postgres levait `22P02 invalid input syntax for type
 * uuid` qui, non capturée, devenait une erreur serveur **500** (bruit de
 * monitoring, contrat HTTP incorrect). Un UUID bien formé mais absent doit
 * continuer à renvoyer **404** ; un identifiant syntaxiquement invalide doit
 * renvoyer **400**.
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

/**
 * T-122 (G1) : réponse 400 standard pour un identifiant de ressource
 * mal formé (route dynamique [id]).
 */
export function invalidIdResponse(message = "Identifiant invalide") {
  return NextResponse.json({ error: message }, { status: 400 });
}
