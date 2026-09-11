# Analyse d'impact — T-260 (B7 : capacités de l'API non exposées par l'interface)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **BASE** : `130831e`
- **Niveau** : S (un écran public, aucune route API modifiée).
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.7 (B7)
- **Rapport de validation** : `.ai/REPORTS/validation_T260_2026-09-11_audit6_B7.md`

## 1. Surfaces touchées

| Fichier | Nature | Rôle |
|---|---|---|
| `src/app/(main)/recherche/page.tsx` | modifié | lit `search`/`minRating`/`near`, filtre par note et par distance (SQL), tri `popularity`, formulaire (destination → `search`, note minimale, bouton « Autour de moi »), puce de rayon actif |
| `src/lib/geo-distance.ts` (+ `.test.ts`) | **créé** | `parseNear`, `normalizeNear`, `haversineKm`, `buildNearHref` (purs, testés) |
| `src/components/search-near-me-button.tsx` (+ `.test.tsx`) | **créé** | bouton client `navigator.geolocation` → `near=lat,lng,25`, replis localisés |
| `src/lib/search-warnings.ts` (+ test) | modifié | `minRatingIgnored`, `nearIgnored` (filtres écartés = dits) |
| `src/lib/ui-strings.ts` (+ test) | modifié | +13 clés FR/EN, verrou **1749 → 1762** |
| `next.config.ts` | modifié | `allowedDevOrigins` accepte l'hôte de prévisualisation (`*.e2b.app`) — développement uniquement |

## 2. Effets indirects

1. **`GET /api/properties` : 0 ligne touchée.** Les quatre capacités existaient (T-026) ; c'est
   l'**interface** qui change. Aucun test d'API n'est affecté.
2. **Liens existants** : `?city=` garde exactement sa sémantique d'origine (nom **ou** ville) ; le
   champ destination envoie désormais `search` (nom, ville **et** description, comme l'API). Une URL
   `?city=Paris` déjà indexée renvoie le même résultat qu'avant.
3. **Cache TTL 60 s** : la clé inclut `search`/`minRating`/`near` normalisés — deux rayons ou deux
   notes différentes ne partagent jamais une entrée ; sans ces paramètres la clé est inchangée.
4. **Pagination** : la distance et la note sont filtrées **en SQL avant** `LIMIT/OFFSET` (à la
   différence de l'API qui filtre en JS sur un jeu large) → `total`, `totalPages` et la page
   courante restent cohérents ; l'ordre par distance (quand aucun tri n'est demandé) est stable
   (`properties.id` en second critère).
5. **Bouton client** : sans JavaScript, il est inerte et le formulaire GET reste celui d'avant ;
   le refus de géolocalisation affiche un message et laisse la saisie de ville disponible.
6. **Avertissements T-175** : deux nouveaux cas signalés (note hors 0–10, position invalide),
   dans la liste existante — aucun changement de moteur.

## 3. Risques de régression et traitement

| Risque | Traitement |
|---|---|
| `search` change les résultats de liens existants | Les liens existants utilisent `city` (sémantique intacte) ; `search` est additif |
| Distance en SQL = divergence avec la formule JS de l'API | Même haversine, rayon 6371 km, `acos` borné `[-1,1]` ; `haversineKm` testé sur Paris–Lyon et Paris–Marseille |
| Géolocalisation indisponible/refusée | Message localisé + repli documenté (saisie de ville) ; aucun état bloquant |
| Note minimale ou `near` mal formés | Filtre écarté + bandeau T-175 (`minRatingIgnored` / `nearIgnored`), comme les autres paramètres |
| Champ destination renommé | `?city=` reste relu (`defaultValue={params.search ?? params.city}`) et filtré |

## 4. Revérification

`tsc` 0 · `eslint` 0/0 · vitest complet **146 f / 812 t** · sondes runtime FR et EN (voir rapport de
validation) · `ai:check` · CI complète avant commit.
