# 🎛️ Simulation dashboards — filtres / sélection / actions groupées

**Généré le** : 2026-08-21 13:40
**T-033 (Session 12) + T-034 (Session 13)**

Vérifie l'implémentation des raccourcis dashboards :
- Filtres de recherche + statut par entité
- Cases à cocher + tout-sélectionner
- Actions groupées (bulk API + guards)
- Raccourcis clavier (/, Ctrl+A, Échap)
- Audit log de chaque bulk action

## 🎯 Résumé

- ✅ **69 OK**
- ⚠️ **0 WARN**
- ❌ **0 KO**
- Total : **69**

Verdict : **✅ TOUT PASSE**

---


## 1. Pages dashboard branchées sur leurs Managers (statique)

- ✅ **dashboard/users/page.tsx importe et rend <UsersManager>**
  <sub>grep UsersManager : trouvé</sub>

- ✅ **dashboard/properties/page.tsx importe et rend <PropertiesManager>**
  <sub>grep PropertiesManager : trouvé</sub>

- ✅ **dashboard/reviews/page.tsx importe et rend <ReviewsManager>**
  <sub>grep ReviewsManager : trouvé</sub>

- ✅ **dashboard/bookings/page.tsx importe et rend <BookingsManager>**
  <sub>grep BookingsManager : trouvé</sub>

- ✅ **dashboard/rooms/page.tsx importe et rend <RoomsManager>**
  <sub>grep RoomsManager : trouvé</sub>

- ✅ **dashboard/promotions/page.tsx importe et rend <PromotionsManager>**
  <sub>grep PromotionsManager : trouvé</sub>

- ✅ **dashboard/messages/page.tsx importe et rend <MessagesManager>**
  <sub>grep MessagesManager : trouvé</sub>

- ✅ **dashboard/audit/page.tsx importe et rend <AuditFilter>**
  <sub>grep AuditFilter : trouvé</sub>


## 2. Composants Manager exposent filtres + sélection + actions

- ✅ **src/components/bulk/bulk-toolbar.tsx : contient 9 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/users-manager.tsx : contient 9 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/properties-manager.tsx : contient 9 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/reviews-manager.tsx : contient 8 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/bookings-manager.tsx : contient 8 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/rooms-manager.tsx : contient 10 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/promotions-manager.tsx : contient 10 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/messages-manager.tsx : contient 4 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/audit-filter.tsx : contient 4 patterns requis**
  <sub>tous présents</sub>

- ✅ **src/components/bulk/row-delete-button.tsx : contient 5 patterns requis**
  <sub>tous présents</sub>


## 3. API bulk : RBAC (guards)

- ✅ **sans cookie → 403**
  <sub>code=403 body={"error":"Accès admin requis"}</sub>

- ✅ **customer → 403**
  <sub>code=403</sub>

- ✅ **host → 403**
  <sub>code=403</sub>


## 4. API bulk : validation payload

- ✅ **entity manquante → 400**
  <sub>{"error":"Invalid option: expected one of \"users\"|\"properties\"|\"reviews\"|\"bookings\"|\"rooms\"|\"promotions\""}</sub>

- ✅ **entity invalide → 400**
  <sub>{"error":"Invalid option: expected one of \"users\"|\"properties\"|\"reviews\"|\"bookings\"|\"rooms\"|\"promotions\""}</sub>

- ✅ **ids=[] → 400**
  <sub>{"error":"Too small: expected array to have >=1 items"}</sub>

- ✅ **ids > 100 → 400**
  <sub>{"error":"Invalid UUID"}</sub>

- ✅ **UUID invalide → 400**
  <sub>{"error":"Invalid UUID"}</sub>

- ✅ **action=kill sur users → 400**
  <sub>{"error":"Action invalide pour users : kill"}</sub>


## 5. API bulk : ID inexistant → skipped (pas failed)

- ✅ **id inexistant → 200 skipped:1 (pas failed)**
  <sub>body={"entity":"users","action":"suspend","requested":1,"succeeded":0,"skipped":[{"id":"00000000-0000-0000-0000-000000000000","reason":"user introuvable ou est admin"}],"failed":[]}</sub>


## 6. Admin auto-protection : impossible de se suspendre soi-même

- ✅ **admin tente self-suspend → skipped avec raison**
  <sub>body={"entity":"users","action":"suspend","requested":1,"succeeded":0,"skipped":[{"id":"957172b3-2ba3-4d50-bc05-425ee16dc0e4","reason":"L'admin ne peut pas s'auto-modifier via bulk"}],"failed":[]}</sub>

- ✅ **bulk suspend sur un autre admin → skipped (ne(role, admin))**
  <sub>body={"entity":"users","action":"suspend","requested":1,"succeeded":0,"skipped":[{"id":"ca34c43f-e690-4ab8-8874-87279a9ce0ab","reason":"user introuvable ou est admin"}],"failed":[]}</sub>


## 7. Bulk users : suspend → réactivate cycle complet

- ✅ **Créer 3 users test : 3/3**
  <sub>ids: ['848fc0d2', 'c07b2d66', '69fb8698']</sub>

- ✅ **Bulk suspend 3 users → succeeded=3**
  <sub>{"entity":"users","action":"suspend","requested":3,"succeeded":3,"skipped":[],"failed":[]}</sub>

- ✅ **DB check : 3/3 users suspended**

- ✅ **Bulk reactivate 3 users → succeeded=3**
  <sub>{"entity":"users","action":"reactivate","requested":3,"succeeded":3,"skipped":[],"failed":[]}</sub>

- ✅ **Bulk anonymize 3 users → succeeded=3**
  <sub>{"entity":"users","action":"anonymize","requested":3,"succeeded":3,"skipped":[],"failed":[]}</sub>

- ✅ **DB check : 3/3 users anonymisés**


## 8. Bulk properties : approve

- ✅ **Bulk approve 2 properties (créées à la volée) → succeeded=2**
  <sub>body={"entity":"properties","action":"approve","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>


## 9. Bulk reviews : approve/hide

- ✅ **Bulk hide 3 reviews → succeeded=3**
  <sub>{"entity":"reviews","action":"hide","requested":3,"succeeded":3,"skipped":[],"failed":[]}</sub>

- ✅ **Bulk approve 3 reviews → succeeded=3**
  <sub>{"entity":"reviews","action":"approve","requested":3,"succeeded":3,"skipped":[],"failed":[]}</sub>


## 10. Bulk bookings : cancel respecte la machine à états

- ✅ **Bulk cancel mix (1 valide + 1 déjà cancelled) → 1×OK + 1×skipped**
  <sub>succ=1 skipped=[{'id': '5afdd5c0-2394-47ba-98b2-d3382f638446', 'reason': "transition invalide depuis 'cancelled'"}]</sub>


## 11. Audit log : bulk.action enregistré

- ✅ **GET /api/admin/audit contient 16 entrée(s) 'bulk.action'**
  <sub>actions récentes : [('bookings', 'cancel'), ('reviews', 'approve'), ('reviews', 'hide'), ('properties', 'approve'), ('users', 'anonymize')]</sub>


## 12. Pages dashboards HTTP 200 pour l'admin

- ✅ **GET /dashboard/users → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/properties → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/reviews → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/bookings → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/rooms → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/promotions → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/messages → 200**
  <sub>code=200</sub>

- ✅ **GET /dashboard/audit → 200**
  <sub>code=200</sub>


## 12bis. T-034 : icônes de suppression par ligne (data-testid row-delete-*)

- ✅ **/dashboard/users contient au moins un bouton row-delete-users**
  <sub>needle 'row-delete-users' trouvé dans le HTML</sub>

- ✅ **/dashboard/properties contient au moins un bouton row-delete-properties**
  <sub>needle 'row-delete-properties' trouvé dans le HTML</sub>

- ✅ **/dashboard/reviews contient au moins un bouton row-delete-reviews**
  <sub>needle 'row-delete-reviews' trouvé dans le HTML</sub>

- ✅ **/dashboard/rooms contient au moins un bouton row-delete-rooms**
  <sub>needle 'row-delete-rooms' trouvé dans le HTML</sub>

- ✅ **/dashboard/promotions contient au moins un bouton row-delete-promotions**
  <sub>needle 'row-delete-promotions' trouvé dans le HTML</sub>


## 12ter. T-034 : bulk sur rooms + promotions

- ✅ **Bulk activate 2 rooms → succeeded=2**
  <sub>{"entity":"rooms","action":"activate","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>

- ✅ **Bulk deactivate 2 rooms → succeeded=2**
  <sub>{"entity":"rooms","action":"deactivate","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>

- ✅ **DB check : 2/2 rooms inactives**

- ✅ **Bulk delete 2 rooms → succeeded=2**
  <sub>{"entity":"rooms","action":"delete","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>

- ✅ **DB check : rooms supprimées (count=0)**
  <sub>count=0</sub>

- ✅ **Bulk deactivate 2 promotions → succeeded=2**
  <sub>{"entity":"promotions","action":"deactivate","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>

- ✅ **Bulk activate 2 promotions → succeeded=2**
  <sub>{"entity":"promotions","action":"activate","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>

- ✅ **Bulk delete 2 promotions non utilisées → succeeded=2**
  <sub>{"entity":"promotions","action":"delete","requested":2,"succeeded":2,"skipped":[],"failed":[]}</sub>

- ✅ **Bulk delete promotion déjà utilisée → skipped**
  <sub>{"entity":"promotions","action":"delete","requested":1,"succeeded":0,"skipped":[{"id":"a7e9519a-09ac-4299-96a6-66f978af48c7","reason":"promotion déjà utilisée (3× ) — désactivez plutôt"}],"failed":[]}</sub>


## 12quater. T-034 : action=delete sur users/reviews/properties

- ✅ **Bulk delete 1 review → succeeded=1**
  <sub>{"entity":"reviews","action":"delete","requested":1,"succeeded":1,"skipped":[],"failed":[]}</sub>

- ✅ **DB check : review supprimée**
  <sub>count=0</sub>

- ✅ **Bulk delete 1 user (alias anonymize) → succeeded=1**
  <sub>{"entity":"users","action":"delete","requested":1,"succeeded":1,"skipped":[],"failed":[]}</sub>

- ✅ **DB check : user email anonymisé → deleted-3e4f59dbc6df2869@anonymized.local**
  <sub>deleted-3e4f59dbc6df2869@anonymized.local</sub>

- ✅ **Bulk delete 1 property sans booking → succeeded=1**
  <sub>{"entity":"properties","action":"delete","requested":1,"succeeded":1,"skipped":[],"failed":[]}</sub>


## 13. Bulk API : audit log inclut metadata complète

- ✅ **Audit metadata contient operation+requested+succeeded+ids**
  <sub>metadata: {'ids': ['0da70397-df38-49a4-86b7-20ced8e21bc7'], 'failed': 0, 'skipped': 0, 'operation': 'suspend', 'requested': 1, 'succeeded': 1}</sub>


---

## Reproductibilité

`python3 scripts/dashboards_sim.py` (après `npm run db:dev` + `npx next dev`).
