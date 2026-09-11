import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";

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

/**
 * T-137 (A1) : message français pour la première erreur d'un `ZodError`.
 *
 * Une grande partie des schémas de validation ne fournit pas de message
 * explicite : Zod renvoie alors ses libellés par défaut en anglais
 * (« Too small: expected number to be >=1 », « Invalid email address »,
 * « Too big… »). Exposés tels quels via `error.issues[0].message`, ces
 * textes techniques fuyaient jusqu'au navigateur sur des routes grand
 * public (réservation, avis, alertes de prix…), en contradiction avec une
 * interface 100 % française.
 *
 * On privilégie toujours un message explicite déjà en français (s'il ne
 * ressemble pas à un libellé Zod anglais) ; sinon on traduit les codes
 * d'erreur natifs selon le type de champ et la nature de la validation.
 * Les messages personnalisés passés dans le schéma restent intacts :
 * cette fonction ne fait que fournir un libellé de repli.
 */
function looksLikeDefaultZodEnglish(message: string): boolean {
  // Les messages par défaut de Zod sont des phrases types en anglais.
  return /^(Invalid |Too |Expected |Required|String must|Number must|Array must)/.test(
    message,
  );
}

function issueToFrench(issue: {
  code: string;
  message: string;
  path: PropertyKey[];
}): string {
  const field = String(issue.path[issue.path.length - 1] ?? "");
  const isUuidField = /(^|_)id$|Id$/.test(field) || field.toLowerCase().includes("uuid");
  switch (issue.code) {
    case "invalid_type":
      if (field === "email" || field === "guestEmail") {
        return "Adresse email invalide";
      }
      return "Valeur invalide ou manquante";
    case "invalid_format":
      // Zod v4 : email()/uuid() émettent `invalid_format` avec un message
      // anglais (« Invalid email address », « Invalid UUID »).
      if (field === "email" || field === "guestEmail" || /email/i.test(issue.message)) {
        return "Adresse email invalide";
      }
      if (isUuidField || /uuid/i.test(issue.message)) return "Identifiant invalide";
      return "Format invalide";
    case "invalid_string":
      // Zod v3 : email()/uuid() émettent `invalid_string`.
      if (field === "email" || field === "guestEmail" || /email/i.test(issue.message)) {
        return "Adresse email invalide";
      }
      if (isUuidField || /uuid/i.test(issue.message)) return "Identifiant invalide";
      return "Format invalide";
    case "too_small":
      // min(1) sur une note/un nombre d'occupants, min(2/3) sur un texte…
      if (/number|integer/i.test(issue.message)) {
        return "Valeur trop petite";
      }
      // Un texte en min(1) vide → champ requis (plus parlant que « trop court »).
      if (/string/i.test(issue.message)) return "Ce champ est requis";
      return "Texte trop court";
    case "too_big":
      if (/number|integer/i.test(issue.message)) {
        return "Valeur trop grande";
      }
      return "Texte trop long";
    default:
      return "Valeur invalide";
  }
}

/**
 * Extrait un message d'erreur en français d'une `ZodError`. Préserve les
 * messages personnalisés (déjà rédigés en français) et ne traduit que les
 * libellés Zod par défaut restés en anglais.
 */
/**
 * T-241 (F13) — Détail **champ par champ** des erreurs de validation.
 *
 * Constat d'audit : `frenchZodMessage()` ne renvoyait que la **première**
 * erreur, si bien qu'un formulaire qui en envoie trois n'en découvrait
 * qu'une par tentative. On ajoute ici un tableau `issues` **en plus** du
 * message (champ additif : les clients existants continuent de lire
 * `error`), chaque libellé passant par la même traduction que le message
 * principal — aucun message Zod anglais ne fuit côté client (règle T-159).
 */
export function zodIssues(error: {
  issues?: Array<{
    code: string;
    message: string;
    path: PropertyKey[];
    keys?: PropertyKey[];
  }>;
}): Array<{ field: string; message: string }> {
  const issues = error?.issues ?? [];
  const flat: Array<{ field: string; message: string }> = [];
  for (const issue of issues) {
    // Champ(s) inconnu(s) : zod v4 les regroupe dans `keys` (chemin vide).
    // On les éclate pour que l'UI puisse annoter chaque champ fautif.
    if (issue.code === "unrecognized_keys" && issue.keys?.length) {
      for (const key of issue.keys) {
        flat.push({
          field: String(key),
          message: `Champ inconnu : ${String(key)}`,
        });
      }
      continue;
    }
    flat.push({
      field: (issue.path ?? []).map((segment) => String(segment)).join(".") || "_",
      message:
        issue.message && !looksLikeDefaultZodEnglish(issue.message)
          ? issue.message
          : issueToFrench(issue),
    });
  }
  return flat.slice(0, 20);
}

/**
 * T-241 (F13) — Réponse **400** uniforme pour une `ZodError` :
 * `{ error, issues: [{ field, message }] }`. Le message garde sa forme
 * historique (première erreur, en français), `issues` permet à l'UI
 * d'annoter les champs fautifs. `messageOverride` sert aux routes qui
 * imposent un libellé métier (ex. rotation de credentials).
 */
export async function zodErrorResponse(
  error: Parameters<typeof frenchZodMessage>[0],
  messageOverride?: string,
): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: await apiError(messageOverride ?? frenchZodMessage(error)),
      issues: zodIssues(error),
    },
    { status: 400 },
  );
}

export function frenchZodMessage(error: {
  issues?: Array<{
    code: string;
    message: string;
    path: PropertyKey[];
  }>;
}): string {
  const first = error?.issues?.[0];
  if (!first) return "Paramètres invalides";
  if (first.message && !looksLikeDefaultZodEnglish(first.message)) {
    return first.message;
  }
  return issueToFrench(first);
}
