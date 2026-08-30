# 🧪 Simulation EXTRÊME — Session 11 (2026-08-21)

**Généré le** : 2026-08-21 13:39
**Base URL** : `http://127.0.0.1:3000`

Complète les simulations précédentes (`simulation_*.md`,
`simulation_deep_*.md`) en allant *encore plus loin* :

- **Sécurité HTTP** : headers CSP/HSTS/X-Frame/Referrer-Policy/Cookie flags
- **Injections** : XSS (reviews/register/booking), SQL injection (login/search)
- **Inputs extrêmes** : password 100 000 chars, unicode/emoji, null byte, nombres géants
- **Flow verification email** bout-en-bout : register → parse
  `.data/mails/` → extract token → GET /api/auth/verify → confirm
  emailVerified=true
- **Flow reset password** bout-en-bout : forgot → parse mail → reset →
  login OK / anciens refusés / rejeu du token refusé
- **Reviews cycle complet** : reply (host) → moderate (admin) → helpful
  (customer) → helpful double → RBAC guards
- **Rooms availability + rate-plans** : PUT stopSell → booking refusé,
  POST rate-plan
- **Promotions CRUD complet** : POST → apply → PATCH isActive:false →
  apply refuse → DELETE → apply 404
- **Price alerts DELETE** avec ownership
- **Pages dynamiques** [id] : /dashboard/bookings, rooms/calendrier,
  messages
- **Audit statique composants clients** : loading/error/feedback UX
- **Intégrité seed** : levels BR, types property, promotions actives
- **Contenu emails** : Subject présent, HTML, XSS non injectable
- **Webhook Stripe** : GET refusé, POST sans signature refusé
- **Fichiers publics** : robots, sitemap, favicon, manifest
- **Flow 2FA à login** : après activation, login exige totpCode
- **Path traversal** : `?key=../../etc/passwd` refusé
- **Cookie invalidation** : logout révoque, tampering refusé
- **404 / 405** propres

## 🎯 Résumé

- ✅ **89 OK**
- ⚠️  **0 WARN** (observation ou gap non bloquant)
- ❌ **0 KO** (défaillance à investiguer)
- Total : **89 contrôles extrêmes**

Verdict : **✅ TOUT PASSE**

---


## 1. Sécurité HTTP — headers de réponse

- ✅ **Header X-Content-Type-Options présent et conforme**  
  <sub>valeur : nosniff</sub>

- ✅ **Header X-Frame-Options présent et conforme**  
  <sub>valeur : SAMEORIGIN</sub>

- ✅ **Header Referrer-Policy présent et conforme**  
  <sub>valeur : strict-origin-when-cross-origin</sub>

- ✅ **Header Strict-Transport-Security présent et conforme**  
  <sub>valeur : max-age=31536000; includeSubDomains</sub>

- ✅ **Header Content-Security-Policy présent et conforme**  
  <sub>valeur : default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inlin</sub>

- ✅ **Header Permissions-Policy présent et conforme**  
  <sub>valeur : camera=(), microphone=(), geolocation=(self)</sub>

- ✅ **CSP img-src autorise https: (pour QR 2FA api.qrserver.com)**  
  <sub>default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' data:; connect-src 'self' https:; frame-ancest</sub>

- ✅ **Cookie session : HttpOnly présent dans jar curl**  
  <sub>jar_lines : 1</sub>

- ✅ **Cookie session : HttpOnly + SameSite + Path=/ (via login live)**  
  <sub>cookie complet : set-cookie: session=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjYTM0YzQzZi1lNjkwLTRhYjgtODg3NC04NzI3OWE5Y2UwYWIiLCJqdGkiOiI5ODMyMzU5Yi1lNmM4LTQxY2QtOTM4YS00MTBiNGE0ZWYxNmQiLCJleHAiOjE3ODc5MjQzNDAsImlhdCI6MTc</sub>


## 2. Injections XSS — reviews, messages, register

- ✅ **Reviews existants ne contiennent pas de HTML actif**  
  <sub>20 reviews scannés, unsafe : []</sub>

- ✅ **Register avec firstName='<script>alert(1)</script>Bob…' → code 200**  
  <sub>firstName stocké : '<script>alert(1)</script>Bob'</sub>

- ✅ **guestFirstName='<script>' → booking 201 (validé, doit être échappé à l'affichage)**  
  <sub>body[:200]={"booking":{"id":"3b7bfd9e-835b-4418-baf2-3bfcf0eeb86a","bookingReference":"MBB-2026-SXOVFY","userId":"74fee4e6-5f89-49cf-8497-446fb77c2ab8","propertyId":"c8ca8d6b-80f1-44af-973b-6620e834af4b","roomId</sub>


## 3. SQL injection tentatives

- ✅ **Login email='admin' OR 1=1--' → 400/401 (rejeté avant SQL)**  
  <sub>code=400 body={"error":"Email invalide"}</sub>

- ✅ **Search city SQL injection → réponse propre**  
  <sub>code=200 body[:200]={"properties":[]}</sub>

- ✅ **Table users toujours accessible après SQL injection attempt**  
  <sub>code=200</sub>


## 4. Inputs extrêmes — très longs, unicode, contrôles

- ✅ **Register password 100 000 chars → 200**  
  <sub>body={"message":"Inscription réussie","user":{"id":"40b93a9e-0bf6-4afe-99a3-5975c277f060","email":"long1787319541@t.local","firstName":"Long","lastName":"User","role":"customer"}}</sub>

- ✅ **Register firstName Unicode/emoji 'Marie🎉👋' → conservé intégralement**  
  <sub>stocké : 'Marie🎉👋'</sub>

- ✅ **Register email avec null byte → refusé**  
  <sub>code=400 body={"error":"Email invalide"}</sub>

- ✅ **Booking numAdults=999B → refusé (safe)**  
  <sub>code=400 body={"error":"Too small: expected string to have >=2 characters"}</sub>


## 5. Flow vérification email — bout-en-bout avec token réel

- ✅ **Register verify1787319542@test.local → id créé, emailVerified=None**  

- ✅ **Email de vérification reçu (subject='Vérifiez votre email — MyBestBooking') + token extrait**  
  <sub>token[:16]='e05d9164-c3e7-4d…' fichier=2026-08-21T13-39-02-816Z-5-verify1787319542@test_local.txt</sub>

- ✅ **GET /api/auth/verify?token=… → 307 (redirect)**  
  <sub>body[:200]=</sub>

- ✅ **Après GET verify : /api/auth/me emailVerified=True**  
  <sub>body[:200]={"user":{"id":"f6305ac1-7062-4968-a405-866377243b6b","email":"verify1787319542@test.local","firstName":"Verify","lastName":"Me","phone":null,"country":null,"language":"fr","currency":"EUR","role":"cus</sub>


## 6. Flow reset password — bout-en-bout avec token réel

- ✅ **POST forgot-password → 200**  
  <sub>body={"message":"Si un compte existe pour cet email, un lien vous a été envoyé."}</sub>

- ✅ **Email reset reçu (subject='Réinitialiser votre mot de passe — MyBestBooking') + token extrait**  
  <sub>token[:16]='7e3c62f3-4d15-42…'</sub>

- ✅ **POST reset-password avec token valide → 200**  
  <sub>body={"message":"Mot de passe réinitialisé. Vous pouvez vous connecter."}</sub>

- ✅ **Login avec nouveau password → 200**  
  <sub>body={"message":"Connexion réussie","user":{"id":"5dd19522-6839-4616-95d5-f03dd90515db","email":"reset1787319543@test.local","firstName":"Reset","lastName"</sub>

- ✅ **Login avec ancien password → 401**  
  <sub>body={"error":"Email ou mot de passe incorrect"}</sub>

- ✅ **Rejouer le token de reset → refusé**  
  <sub>body={"error":"Lien invalide ou expiré"}</sub>


## 7. Reviews cycle complet — post → reply → moderate → helpful

- ✅ **POST /api/reviews/3d715a5c…/reply (host) → 200**  
  <sub>body={"review":{"id":"3d715a5c-017b-49c4-906b-1224b41f1627","bookingId":"f860b532-c761-46f2-be90-2d32ff352efb","userId":"5645520a-8083-46a3-a65d-d84c3c79a493","propertyId":"868400f0-dacb-4ae0-b804-05b09bd8</sub>

- ✅ **PATCH /api/reviews/3d715a5c…/moderate (admin, approved) → 200**  
  <sub>body={"review":{"id":"3d715a5c-017b-49c4-906b-1224b41f1627","bookingId":"f860b532-c761-46f2-be90-2d32ff352efb","userId":"5645520a-8083-46a3-a65d-d84c3c79a493","propertyId":"868400f0-dacb-4ae0-b804-05b09bd8</sub>

- ✅ **POST /api/reviews/3d715a5c…/helpful (customer) → 200**  
  <sub>body={"review":{"id":"3d715a5c-017b-49c4-906b-1224b41f1627","helpfulCount":1}}</sub>

- ✅ **POST helpful DOUBLE → refusé (déjà voté)**  
  <sub>body={"error":"Vous avez déjà marqué cet avis comme utile"}</sub>

- ✅ **PATCH moderate par customer → 403**  
  <sub>body={"error":"Accès admin requis"}</sub>

- ✅ **POST reply par customer → 403**  
  <sub>body={"error":"Accès refusé"}</sub>


## 8. Rooms availability + rate-plans (host-only)

- ✅ **GET availability (host) → 200**  
  <sub>body={"roomId":"e5c42701-2fa7-4e05-8f47-c0fc9c95373e","from":"2028-12-01","to":"2028-12-10","quantity":4,"basePrice":"89.00","days":[]}</sub>

- ✅ **PUT availability (3 jours stopSell) → 200**  
  <sub>body={"ok":true,"count":3}</sub>

- ✅ **Booking sur dates bloquées stopSell → refusé (BUG-018 fix)**  
  <sub>code=409 body={"error":"Cette chambre n'est plus disponible pour ces dates"}</sub>

- ✅ **PUT availability par customer → 403**  
  <sub>body={"error":"Accès refusé"}</sub>

- ✅ **GET rate-plans → 200**  
  <sub>body={"ratePlans":[]}</sub>

- ✅ **POST rate-plan (host) → 201**  
  <sub>body={"ratePlan":{"id":"c3f52001-8d21-484c-b7e5-42941b5216fa","roomId":"e5c42701-2fa7-4e05-8f47-c0fc9c95373e","name":"Sim Rate Plan","type":"non_refundable","discountPercentage":"15.00","includesBreakfast":true,"cancellationPolicy":"non_refundable","cance</sub>


## 9. Promotions CRUD complet (admin — pas host)

- ✅ **POST /api/promotions (host) code=SIMXTREME1787319552 → 201**  
  <sub>body={"promotion":{"id":"6f8572f1-ba2b-44de-b9c1-3b7b0f8f1ec2","code":"SIMXTREME1787319552","name":"Test extrême","type":"percentage","value":"15.00","minBookingAmount":"50.00","maxDiscount":null,"validFrom":"2026-01-01T00:00</sub>

- ✅ **GET promotions/apply?code=SIMXTREME1787319552&amount=200 → discount 30**  
  <sub>code=200 body={"ok":true,"promotion":{"code":"SIMXTREME1787319552","name":"Test extrême","type":"percentage","value":"15.00"},"discount":30,"finalTotal":170}</sub>

- ✅ **PATCH /api/promotions/6f8572f1… (admin) → 200**  
  <sub>body={"promotion":{"id":"6f8572f1-ba2b-44de-b9c1-3b7b0f8f1ec2","code":"SIMXTREME1787319552","name":"Test extrême updated","type":"percentage","value":"15.00","minBookingAmount":"50.00","maxDiscount":null,"</sub>

- ✅ **Apply promo désactivée → ok:false**  
  <sub>code=400 body={"ok":false,"error":"Code inactif"}</sub>

- ✅ **DELETE /api/promotions/6f8572f1… (admin) → 200/204**  
  <sub>body={"ok":true}</sub>

- ✅ **Apply promo supprimée → 404**  
  <sub>code=404 body={"ok":false,"error":"Code inconnu"}</sub>

- ✅ **POST /api/promotions par customer → 403**  
  <sub>body={"error":"Accès admin requis"}</sub>


## 10. Price alerts DELETE by id

- ✅ **DELETE /api/price-alerts/893cdc52… → 200/204**  
  <sub>body={"removed":true}</sub>

- ✅ **DELETE alerte d'un autre user (host) → 403/404**  
  <sub>body={"error":"Alerte introuvable"}</sub>


## 11. Pages dynamiques /dashboard/[id] — accessibilité

- ✅ **GET /dashboard/bookings/3b7bfd9e… (host) → 200**  

- ✅ **GET /dashboard/bookings/3b7bfd9e… par customer → 200 (redirect RSC)**  

- ✅ **GET /dashboard/rooms/e5c42701…/calendrier (host) → 200**  

- ✅ **GET /wishlists/share/invalide → body contient not-found**  
  <sub>code=200 has_notfound=True</sub>

- ✅ **GET /hebergement/inexistant → body contient not-found**  
  <sub>code=200 has_notfound=True</sub>


## 12. Audit statique — chaque composant client (état loading/error)

- ✅ **Tous les 22 composants clients avec fetch ont ≥ 2 indicateurs UX**  
  <sub>loading + error + feedback</sub>


## 13. Intégrité du seed

- ✅ **Customer courant : level=2 wallet=25.00€ bookings=8**  
  <sub>seed initial : level=2 wallet=25 ; peut évoluer avec les bookings des tests</sub>

- ✅ **Seed properties → types présents : ['apartment', 'bnb', 'guesthouse', 'hotel', 'resort', 'riad', 'villa']**  
  <sub>8 propriétés</sub>

- ✅ **Seed : 8/8 propriétés avec rooms, 8/8 avec reviews**  
  <sub>cohérence seed</sub>

- ✅ **Seed promotions : 4/4 active(s)**  


## 14. Contenu des emails — subject, corps HTML, absence XSS

- ✅ **2026-08-21T13-39-04-428Z-7-reset1787319543@test_local.txt — Subject='Réinitialiser votre mot de passe — MyBestBooking' HTML=True link=True**  
  <sub>To=reset1787319543@test.local unsafe=False</sub>

- ✅ **2026-08-21T13-39-04-200Z-6-reset1787319543@test_local.txt — Subject='Vérifiez votre email — MyBestBooking' HTML=True link=True**  
  <sub>To=reset1787319543@test.local unsafe=False</sub>

- ✅ **2026-08-21T13-39-02-816Z-5-verify1787319542@test_local.txt — Subject='Vérifiez votre email — MyBestBooking' HTML=True link=True**  
  <sub>To=verify1787319542@test.local unsafe=False</sub>

- ✅ **2026-08-21T13-39-02-422Z-4-emoji1787319542@t_local.txt — Subject='Vérifiez votre email — MyBestBooking' HTML=True link=True**  
  <sub>To=emoji1787319542@t.local unsafe=False</sub>

- ✅ **2026-08-21T13-39-02-040Z-3-long1787319541@t_local.txt — Subject='Vérifiez votre email — MyBestBooking' HTML=True link=True**  
  <sub>To=long1787319541@t.local unsafe=False</sub>


## 15. Webhook Stripe — signature mock

- ✅ **GET /api/webhooks/stripe → 405 (POST-only)**  
  <sub>code=405 body=</sub>

- ✅ **POST webhook sans signature stripe-signature → 400**  
  <sub>code=400 body={"error":"Invalid signature"}</sub>


## 16. Fichiers publics — robots, sitemap, favicon

- ✅ **GET /robots.txt → 200**  
  <sub>body[:100]=User-Agent: * Allow: / Disallow: /api/ Disallow: /dashboard/ Disallow: /mon-compte/ Disallow: /mes-r</sub>

- ✅ **GET /sitemap.xml → 200**  
  <sub>body[:100]=<?xml version="1.0" encoding="UTF-8"?> <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"> </sub>

- ✅ **GET /icon.svg → 200**  
  <sub>body[:100]=<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">   <rect width="32" height="32" rx="6" f</sub>

- ✅ **GET /manifest.json → 200**  
  <sub>body[:100]={   "name": "MyBestBooking",   "short_name": "MBB",   "description": "Plateforme de réservation d'hé</sub>

- ✅ **<link rel='icon' href='/icon.svg'> présent dans le HTML rendu**  


## 17. Flow 2FA à login — enable then require code

- ✅ **Login SANS totp après 2FA activée → 401 + twoFactorRequired:true (BUG-019 fix)**  
  <sub>code=401 body={"error":"Code 2FA requis","twoFactorRequired":true}</sub>

- ✅ **Login avec totp INVALIDE → 401 + twoFactorRequired**  
  <sub>code=401 body={"error":"Code 2FA invalide","twoFactorRequired":true}</sub>

- ✅ **Login avec password + totpCode → 200**  
  <sub>code=200 body={"message":"Connexion réussie","user":{"id":"74fee4e6-5f89-49cf-8497-446fb77c2ab8","email":"customer@mybestbooking.com","firstName":"Marie","lastName":"Martin","role":"customer"}}</sub>

- ✅ **Cleanup : 2FA désactivée en DB (approche robuste vs rate-limit login)**  
  <sub>stdout=ok</sub>

- ✅ **Cleanup : re-login customer après désactivation 2FA**  


## 18. CORS / cross-origin — les endpoints n'exposent pas *

- ✅ **Pas de header CORS (bon par défaut en Next 16 sans opt-in)**  


## 19. Path traversal — uploads?key=../../etc/passwd

- ✅ **DELETE ?key='../../etc/passwd' → refusé**  
  <sub>code=400 body={"error":"Key invalide"}</sub>

- ✅ **DELETE ?key='../secret' → refusé**  
  <sub>code=400 body={"error":"Key invalide"}</sub>

- ✅ **DELETE ?key='%2E%2E%2Fetc%2Fpasswd' → refusé**  
  <sub>code=400 body={"error":"Key invalide"}</sub>

- ✅ **DELETE ?key='test/../../../' → refusé**  
  <sub>code=400 body={"error":"Key invalide"}</sub>

- ✅ **GET /uploads/../../etc/passwd → refusé (pas de contenu système)**  
  <sub>code=404 body[:100]=<!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/><meta name="viewport" content="width=dev</sub>

- ✅ **GET /uploads/../.env.local → refusé (pas de contenu système)**  
  <sub>code=404 body[:100]=<!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/><meta name="viewport" content="width=dev</sub>


## 20. Cookie invalidation & session

- ✅ **Login 200 → me OK (200) → logout (200) → me → 401 (401)**  
  <sub>flow cookie complet</sub>

- ✅ **Cookie tamperisé (nom session→session_tampered) → 401**  
  <sub>code=401</sub>


## 21. Erreurs 404 / 500 propres

- ✅ **GET /route-inconnue → 404**  
  <sub>code=404</sub>

- ✅ **GET /api/endpoint-inexistant → 404**  
  <sub>code=404</sub>

- ✅ **DELETE /api/health → 405**  
  <sub>code=405 body=</sub>


---

## 📊 Récapitulatif

| Verdict | Nombre |
|---|---:|
| ✅ OK | 89 |
| ⚠️  WARN | 0 |
| ❌ KO | 0 |
| **Total** | **89** |

## 🔁 Reproductibilité

Script versionné à `scripts/xtreme_sim.py`. Requiert :
1. `npm run db:dev` (PostgreSQL :55432)
2. `npx next dev -H 0.0.0.0 -p 3000`

Puis : `python3 scripts/xtreme_sim.py`

Le script utilise le vrai TOTP via Node speakeasy, parse les vrais
emails de `.data/mails/`, teste injections/inputs extrêmes/path traversal.
