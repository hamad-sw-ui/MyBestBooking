import type { NextRequest } from "next/server";

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
