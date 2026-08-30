# T-126 — Analyse d'impact (§14) : durcissements de l'audit fonctionnel n°6

- **Date** : 2026-08-28 · **Tâche** : T-126 (niveau **L** — validations locales, aucun contrat cassé, aucune migration)
- **Origine** : `REPORTS/audit_fonctionnel_profond6_2026-08-28.md` (P1–P3)
- **Principe** : durcissements **additifs** de validation ; aucun comportement sain ne change ; l'exécution financière reste défensive (inchangée).

## 1. Périmètre

| Ref | Correctif | Fichiers | Niveau |
|-----|-----------|----------|--------|
| **P1** | Validation de création de promo : pourcentage ≤ 100 (type `percentage`) et `validUntil > validFrom`. Refus à 400 sinon. | `src/app/api/promotions/route.ts` (+ garde miroir côté formulaire) | L |
| **P2** | Double vote « utile » → **409 Conflict** (au lieu de 429) quand l'utilisateur a déjà voté ; le 429 reste réservé au vrai spam. | `src/app/api/reviews/[id]/helpful/route.ts` | L |
| **P3** | Upload d'image : rejet (400) si la signature réelle du fichier (magic bytes) ne correspond pas au type d'image déclaré. | `src/app/api/properties/upload/route.ts` (+ helper pur testable) | L |

## 2. Les 9 questions (§14)

**Q1 — Fichiers touchés ?** La route POST promotions, la route POST helpful, la route POST upload + un petit helper `sniffImageMime` dans `src/lib/storage` (pur, testable) ; le formulaire promo reçoit une validation miroir.

**Q2 — Contrats d'API ?** Aucun champ modifié ni supprimé. Seuls les **codes retour** changent sur des entrées invalides :
- Promo incohérente : 400 (avant 201) — c'est le but ; les promos valides continuent de renvoyer 201.
- Double vote : 409 (avant 429). Le composant front se désactive déjà après vote (`state="done"`) et n'affiche pas le statut d'erreur en flux normal ; aucun comportement légitime ne dépendait du 429.
- Faux fichier image : 400 (avant 201) ; les vraies images passent.

**Q3 — Données ?** Aucune migration, aucun changement de schéma. Les promotions déjà créées avec des valeurs incohérentes (il n'en reste pas en base — nettoyées) ne sont pas touchées ; la validation ne s'applique qu'à la création/mise à jour.

**Q4 — Parcours (3 rôles) ?**
- Admin : formulaire promo refusé en aval si pourcentage > 100 ou dates inversées (message clair) ; vraies promos inchangées.
- Customer/auteur d'avis : revoter affiche une sémantique « déjà voté » (409) ; le 1er vote reste 200.
- Hôte (upload) : les vraies photos JPEG/PNG/WebP/GIF passent ; un fichier déguisé est refusé.

**Q5 — Composants critiques ?** Aucun impact sur le calcul financier : `applyPromoToTotal` reste défensif (`Math.min(discount, total)`), la commission et le wallet ne bougent pas. P3 ne fait que lire les premiers octets du flux déjà reçu (taille déjà plafonnée à 5 Mo).

**Q6 — Tests existants ?** Tests promotions (`promotions`), storage (`storage/local.test.ts`), reviews. On ajoute des tests purs pour le sniff d'image et, si possible, pour la validation promo (schéma exporté).

**Q7 — Effets de bord ?** Aucun email/cron/settings touché. Le helper de sniff est synchrone et sans I/O.

**Q8 — Risques de régression ?**
- P1 : une promo `fixed_amount` avec une « valeur » élevée ne doit PAS être plafonnée à 100 (ce n'est pas un pourcentage) → la garde ne s'applique qu'au type `percentage`. Les dates sont des chaînes YYYY-MM-DD déjà validées par le formulaire ; on compare via `new Date()`.
- P2 : ne pas casser l'anti-double-clic (le rate-limit peut rester en garde haute fréquence, mais le doublon persisté doit donner 409). On vérifie d'abord l'existence du vote (contrainte unique) → 409, sinon le rate-limit → 429.
- P3 : ne pas rejeter les vraies images dont l'encodeur ajoute un en-tête ; on contrôle les signatures connues (JPEG `FF D8 FF`, PNG `89 50 4E 47`, GIF `GIF8`, WebP `RIFF….WEBP`). Un type déclaré mais au contenu non image → 400.

**Q9 — Validation (§13) ?** typecheck · lint · tests (nouveaux tests purs) · build · smoke · ai:check, plus exécution manuelle des 3 parcours.

## 3. Conception (§15.1)

- **P1** : deux `.refine()` sur `createSchema` (objet) :
  - `type !== "percentage" || (value > 0 && value <= 100)` → message « Une remise en pourcentage doit être comprise entre 0 et 100 ».
  - `new Date(validUntil) > new Date(validFrom)` → « La date de fin doit être postérieure à la date de début ».
  Le handler transforme déjà les `ZodError` en 400. Garde miroir dans `promotion-form.tsx` (retour avant l'appel).
- **P2** : dans la transaction, si `onConflictDoNothing` ne renvoie pas de ligne (vote déjà existant) → réponse **409** « Vous avez déjà marqué cet avis comme utile ». Le rate-limit (anti-spam) est conservé en amont mais le message de doublon vise la persistance. On garde le 429 pour le dépassement de fréquence.
- **P3** : helper pur `sniffImageMime(bytes: Uint8Array): string | null` renvoyant le MIME réel (`image/jpeg|png|gif|webp`) ou `null`. À l'upload, lire les premiers octets du `File` (déjà disponible via `formData()`), comparer au MIME déclaré autorisé ; si `null` ou mismatch → 400 « Le fichier n'est pas une image valide ».

## 4. Sécurité / finance
- Aucun contournement d'autorisation introduit (les rôles restent vérifiés en amont).
- P3 réduit la surface de stockage de contenu non-image sous une extension image.

## 5. Rollback
Révert du commit ; aucune migration à annuler.
