# 🎯 TÂCHE EN COURS

**ID** : T-156 (audit n°28 — rapport livré, implémentation en attente de validation)

**Niveau de proportionnalité** : S (analyse seule, aucun code ; 7 findings :
1 P1, 3 P2, 3 P3 — solutions proposées dans le rapport et les analyses)

**Titre** : Audit n°28 à l'exécution — annulation par l'hôte (frais au
voyageur + bouton cassé), identité voyageur modifiable en mode connecté,
i18n public partiel, devise d'affichage anonyme (FCFA sans sélecteur),
hygiène des sims, PATCH settings, cohérence 400/409.

**Statut** : **AUDIT (rapport seul)** — T-155 (audit n°27) reste
CLOS/LIVRÉ. Preuves : crawl **40 pages × 4 rôles (160 vérifs, 0
erreur)** + **30 APIs × 4 rôles (120 vérifs, 0 erreur)** + ~20 probes
runtime (curl sessions réelles) + baseline `run_all_sims.py` **5/5 ·
396 OK · 3 WARN · 0 KO**. Aucun fichier `src/` modifié ; artefacts
d'audit purgés (DB vérifiée).

Rapport : `REPORTS/audit_fonctionnel_profond28_2026-08-30.md` (source).

## Synthèse des findings

**🔴 P1**
1. **Annulation par l'hôte** : `cancelBooking` applique la grille de
   politique sans connaître l'acteur → frais **facturés au voyageur**
   (preuve : 277,38 € = 100 % flexible < 24 h) + motif « Annulation
   demandée par le voyageur » + email « Frais d'annulation appliqués »
   ; et le bouton hôte « Annuler » est **inopérant** (quote → 403
   « Accès refusé »). → solution : actor sur `cancelBooking`
   (host/admin → fee 0 + refund intégral + raison/emails dédiés), quote
   autorisé hôte du bien, UI hôte dédiée.

**🟠 P2**
2. **Identité voyageur en mode connecté** : champs invité préremplis
   **mais éditables** ; serveur sans garde pour authed (contournement de
   la vérification d'email réservée à `isGuestBooking`) → confirmation
   envoyée à l'email saisi (preuve : l'hôte du bien a reçu sa propre
   confirmation). → serveur = autorité (identité compte pour user
   connecté), UI lecture seule, option « réserver pour un proche » à
   arbitrer.
3. **i18n public partiel** : fiche propriété EN → « Réserver »×11,
   « par nuit »×12, etc. (Book×13 à côté) ; inventaire : 52 composants
   client sans `makeT` (help-center articles entiers…). → vagues par
   priorité + garde-fou CI warn.
4. **Devise d'affichage anonyme** : bornes prix en FCFA pour tous
   (défaut plateforme XAF), aucun sélecteur public — visiteur EUR tape
   100 (= 0,15 €) → 0 résultat. → sélecteur de devise dans la recherche
   (localStorage, priorité compte > localStorage > locale) ; contrat
   `displayCurrency` inchangé.

**🟢 P3**
5. **Hygiène sims** : réservations/users de test polluent les vues hôte
   (57 résa « Gdpr/Calc/Wallet Test », drafts deep-villa-*) → script de
   purge `--dry-run`.
6. **PATCH settings partiel** → 400 + `issues` Zod anglais exposés →
   merge additif + réponse `{error}` seulement.
7. **Cohérence 409/400** : capacité dépassée → 409 vs promo inconnue →
   400 (T-155) — aligner sur 400 si décision produit.

## Contraintes (inchangées)
- Rapport seul tant que l'utilisateur ne valide pas l'implémentation.
- Solutions sans régression : additifs, pas de migration de schéma, pas
  de changement de contrat API public, cas EUR numériquement identiques.
- Écartés documentés : /reservation anon 200 (guest mode T-109),
  maintenance (garde client + écritures serveur), invoice hôte 200,
  wishlist partage, parrainage, messagerie, chiffres hôte cohérents,
  recherche EN SSR.

## Étape suivante (sur validation)
1. T-156 (P1 annulation hôte — chantier + tests) ; 2. T-157 (P2 identité
   connectée) ; 3. T-158 (P2 i18n vague 1 fiche + sélecteur devise) ;
   4. T-159 (P3 hygiène + settings + cohérence).
