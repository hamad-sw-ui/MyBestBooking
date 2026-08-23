# 🎯 TÂCHE EN COURS

**Tâche :** Aligner session/JWT, bornes temporelles, nettoyage TOTP et vérité des settings admin.
**ID** : T-111
**Niveau** : **S** — sécurité de session et limites opérationnelles.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Périmètre

- rememberMe JWT/DB/cookie cohérent ;
- effacement TOTP actif/pending à anonymisation ;
- 365 nuits maximum pour nouvelles requêtes ;
- retrait UI des settings non consommés.

## Livré et validé

- JWT/session remember cohérents, facteurs TOTP active/pending effacés à anonymisation ;
- borne 365 nuits et settings décoratifs retirés de l’UI.

Tests : typecheck, lint 0 erreur, suite DB seedée, build, smoke et ai check.
