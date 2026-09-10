/**
 * T-217 (P7/BUG-055) — visibilité d'un fil dans la boîte de réception.
 *
 * T-206/F9 masquait les conversations **sans aucun message** pour éviter que
 * la boîte de réception ne se remplisse de fils ouverts puis abandonnés
 * (« Contacter l'hôte » crée le fil ; si l'utilisateur repart sans écrire, le
 * fil restait vide). Effet de bord constaté en audit : l'utilisateur venait
 * d'ouvrir un fil, ne l'écrivait pas, puis ne le retrouvait nulle part dans
 * `/messages` — alors que la conversation existe bien en base et que le même
 * bouton la rouvre (clé `conversationKey` idempotente).
 *
 * Règle retenue, non régressive : un fil contenant au moins un message reste
 * toujours visible ; un fil encore vide reste visible pendant
 * `EMPTY_THREAD_VISIBLE_DAYS` jours après sa création (fenêtre de rattrapage
 * où l'utilisateur peut retrouver et compléter son brouillon). Au-delà, il est
 * à nouveau masqué : la règle anti-pollution de T-206/F9 est conservée pour
 * les fils abandonnés, et aucune donnée n'est supprimée.
 */
export const EMPTY_THREAD_VISIBLE_DAYS = 7;

export const EMPTY_THREAD_VISIBLE_MS = EMPTY_THREAD_VISIBLE_DAYS * 24 * 60 * 60 * 1000;

export interface ConversationVisibilityInput {
  /** Vrai dès qu'au moins un message a été échangé dans le fil. */
  hasMessage: boolean;
  /** Date de création du fil (colonne `conversations.created_at`). */
  createdAt: Date | string;
}

/**
 * Fonction pure (testable hors base) : un fil vide reste visible uniquement
 * dans sa fenêtre de rattrapage. Une date de création absente ou invalide
 * reste visible (fail-open : on préfère montrer un fil vide que perdre un fil
 * que l'utilisateur vient d'ouvrir).
 */
export function isConversationVisible(
  { hasMessage, createdAt }: ConversationVisibilityInput,
  now: Date = new Date(),
): boolean {
  if (hasMessage) return true;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const createdMs = created.getTime();
  if (Number.isNaN(createdMs)) return true;
  return now.getTime() - createdMs <= EMPTY_THREAD_VISIBLE_MS;
}
