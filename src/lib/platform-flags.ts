const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * T-209/F5 — les versements plateforme sont legacy depuis T-207.
 *
 * La lecture du ledger historique reste disponible, mais toute action mutable
 * (création compte, demande/cron de versement) exige un opt-in serveur
 * explicite. Défaut sûr : désactivé, y compris en développement.
 */
export function platformPayoutsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return TRUE_VALUES.has((env.PLATFORM_PAYOUTS_ENABLED ?? "").trim().toLowerCase());
}
