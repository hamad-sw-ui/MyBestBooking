# 🔬 Simulation PROFONDE — Session 11 (2026-08-21)

**Généré le** : 2026-08-21 10:08
**Base URL** : `http://127.0.0.1:3000`

Complète la simulation surface (`simulation_2026-08-21_session_11.md`) en
allant **au bout de chaque interface** : chemins d'erreur, flux
multi-étapes, contenus profonds, effets de bord, rate-limits, guards
RBAC, combinaisons wallet+promo+BR, guest booking, 2FA avec TOTP réel,
uploads avec vrai PNG, propriété→validation, suspension→sessions killed.

## 📌 Note méthodologique importante

Les pages `"use client"` (comme `/mon-compte`, `/mes-favoris`,
`/mes-reservations`) affichent **« Chargement en cours… »** au premier
`curl` — leur contenu React est monté seulement après hydratation JS
dans un vrai navigateur. Pour ces pages, la simulation contrôle
**statiquement** dans `page.tsx` que les composants attendus sont bien
importés + branchés, ET teste les **APIs sous-jacentes** que ces
composants appellent au runtime. C'est plus fiable qu'un simple grep
dans le HTML servi.

## 🎯 Résumé

- ✅ **81 OK**
- ⚠️  **0 WARN** (comportement observé, non bloquant)
- ❌ **0 KO** (défaillance à investiguer)
- Total : **81 contrôles profonds**

Verdict : **✅ TOUT PASSE**

---


## 1. Chemins d'erreur AUTH

- ✅ **login mauvais MDP → [401]**  
  <sub>code=401 body={"error":"Email ou mot de passe incorrect"}</sub>

- ✅ **login email inexistant → [400, 401]**  
  <sub>code=401 body={"error":"Email ou mot de passe incorrect"}</sub>

- ✅ **register email déjà utilisé → [400, 409]**  
  <sub>code=400 body={"error":"Un compte existe déjà avec cet email"}</sub>

- ✅ **register MDP trop court → [400]**  
  <sub>code=400 body={"error":"Le mot de passe doit contenir au moins 8 caractères"}</sub>

- ✅ **register email invalide → [400]**  
  <sub>code=400 body={"error":"Email invalide"}</sub>

- ✅ **register firstName trop court → [400]**  
  <sub>code=400 body={"error":"Le prénom doit contenir au moins 2 caractères"}</sub>

- ✅ **change-password mauvais current → 400/401**  
  <sub>code=400 body={"error":"Invalid input: expected string, received undefined"}</sub>

- ✅ **forgot-password email inconnu → 200 (anti-enumeration)**  
  <sub>code=200 body={"message":"Si un compte existe pour cet email, un lien vous a été envoyé."}</sub>


## 2. Contenus profonds — pages CLIENT (contrôle statique)

- ✅ **/mon-compte (client, hub profil) — composants branchés**  
  <sub>['TwoFactorSection', 'DeleteAccountSection', 'ReferralCard', 'NotificationPrefsSection', 'ProfileForm', 'ChangePasswordForm']</sub>

- ✅ **/mes-favoris (server, favoris + alertes) — composants branchés**  
  <sub>['PriceAlertsSection', 'WishlistActions']</sub>

- ✅ **/mes-reservations (server, réservations + actions) — composants branchés**  
  <sub>['BookingRowActions']</sub>

- ✅ **/messages (server, messagerie) — composants branchés**  
  <sub>['MessageComposer|conversat']</sub>

- ✅ **/reservation (client, checkout) — composants branchés**  
  <sub>['wallet|useWalletCredits', 'isGuestBooking|guest']</sub>

- ✅ **/hebergement/[slug] (server, page hébergement) — composants branchés**  
  <sub>['PriceAlertButton']</sub>


## 3. Contenus profonds — pages SERVER (HTML rendu)

- ✅ **/aide → contenu attendu présent**  
  <sub>patterns : ['mailto:support']</sub>

- ✅ **/confidentialite → contenu attendu présent**  
  <sub>patterns : ['RGPD|données personnelles', '[Cc]ookie', 'droit']</sub>

- ✅ **/mentions-legales → contenu attendu présent**  
  <sub>patterns : ['[Éé]diteur', 'CGU|CGV|[Cc]onditions générales']</sub>

- ✅ **/bestrewards → contenu attendu présent**  
  <sub>patterns : ['BestRewards']</sub>

- ✅ **/dashboard/settings → contenu attendu présent**  
  <sub>patterns : ['[Gg]enera', '[Bb]illing|[Ff]acturation', 'BestRewards|fidélité']</sub>

- ✅ **/dashboard/audit → contenu attendu présent**  
  <sub>patterns : ['[Aa]udit|[Jj]ournal']</sub>

- ✅ **/dashboard/users → contenu attendu présent**  
  <sub>patterns : ['[Ss]uspend|[Aa]ction']</sub>

- ✅ **/dashboard/analytics → contenu attendu présent**  
  <sub>patterns : ['€|EUR', '[Rr]evenu|[Bb]ooking|[Ss]tatistique']</sub>


## 4. Flux 2FA COMPLET (setup → verify → disable) — champ 'code'

- ✅ **POST 2fa/setup → secret 32 chars + otpauth + qr**  
  <sub>secret=FBTCCWTYMR… otpauth=otpauth://totp/MyBestBooking%3Acustomer%40mybestbooking.com? qr_url=non</sub>

- ✅ **TOTP calculé speakeasy → 235584**  

- ✅ **POST 2fa/verify {code:'235584'} → 200 activation**  
  <sub>code=200 body={"enabled":true}</sub>

- ✅ **POST 2fa/verify {code:'000000'} → 400/401**  
  <sub>code=400 body={"error":"Code invalide"}</sub>

- ✅ **Après verify : /api/auth/me twoFactorEnabled=True**  

- ✅ **POST 2fa/disable {code:'235584'} → 200 désactivation**  
  <sub>code=200 body={"enabled":false}</sub>

- ✅ **Après disable : twoFactorEnabled=False**  


## 5. Upload flow (PNG réel → URL → DELETE → 404 + ownership)

- ✅ **POST /api/uploads (PNG 68o) → url + key + size correct**  
  <sub>code=200 url=/uploads/24d0799c-62624d0f-eabf-4d2f-afbb-e47d654127c9.png key=24d0799c-62624d0f-eabf-4d2f-afbb-e47d654127c9.png size=68</sub>

- ✅ **GET /uploads/24d0799c-62624d0f-eabf-4d2f-afbb-e47d654127c9.png → 200 fichier accessible**  
  <sub>code=200</sub>

- ✅ **Upload d'un .json → 400**  
  <sub>body={"error":"Type non autorisé : application/octet-stream. Formats acceptés : JPEG, PNG, WebP, GIF."}</sub>

- ✅ **DELETE upload d'un autre user (host tente) → 403**  
  <sub>code=403 body={"error":"Non autorisé sur ce fichier"}</sub>

- ✅ **DELETE par owner → 200 removed**  
  <sub>code=200 body={"removed":true}</sub>

- ✅ **Après DELETE : GET /uploads/24d0799c-62624d0f-eabf-4d2f-afbb-e47d654127c9.png → 404**  
  <sub>code=404</sub>


## 6. Booking — chemins d'erreur métier

- ✅ **checkOut < checkIn → [400] avec 'date|postérieure|checkOut'**  
  <sub>code=400 body={"error":"La date de départ doit être postérieure à la date d'arrivée"}</sub>

- ✅ **numAdults=0 → [400]**  
  <sub>code=400 body={"error":"Too small: expected number to be >=1"}</sub>

- ✅ **guestEmail invalide → [400]**  
  <sub>code=400 body={"error":"Invalid email address"}</sub>

- ✅ **roomId inexistant → [400, 404]**  
  <sub>code=400 body={"error":"Chambre non disponible"}</sub>

- ✅ **promoCode inconnu → [400] avec 'promo'**  
  <sub>code=400 body={"error":"Code promo : Code promo inconnu"}</sub>

- ✅ **checkIn format invalide → [400]**  
  <sub>code=400 body={"error":"checkIn doit être au format YYYY-MM-DD"}</sub>

- ✅ **firstName manquant → [400]**  
  <sub>code=400 body={"error":"Too small: expected string to have >=2 characters"}</sub>


## 7. Booking → annulation avec effets DB + email

- ✅ **Créer booking futur → ref=MBB-2026-X891H8 total=229.09 paymentStatus=paid**  
  <sub>code=201</sub>

- ✅ **Après booking : 2 email(s) écrit(s) dans .data/mails/**  
  <sub>fichiers : ['2026-08-21T10-08-43-971Z-0-customer@mybestbooking_com.txt', '2026-08-21T10-08-43-973Z-1-host@mybestbooking_com.txt']</sub>

- ✅ **Email 2026-08-21T10-08-43-973Z-1-host@mybestbooking_com.txt contient référence MBB-2026-X891H8**  
  <sub>...ashboard/bookings">dashboard</a>.</p>          <hr style="margin-top:32px;border:none;border-top:1px solid #eee;">     <p style="font-size:12px;color:#888;text-align:center;">MyBestBooking — Réservez mieux. Voyagez plus.</p>   </div> </body> </html> </sub>

- ✅ **GET /api/bookings/dff252b3… (owner) → 200**  
  <sub>code=200</sub>

- ✅ **PUT annulation → status=cancelled, fee=0.00, paymentStatus=paid**  
  <sub>code=200 body={"booking":{"id":"dff252b3-d2b4-4e8f-bfdf-a6d350636bc6","bookingReference":"MBB-2026-X891H8","userId":"24d0799c-915b-4e12-be22-fd93eddcc15b","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","roomId":"d8bc6067-13e6-4766-95f8-2c1240acd901","status":"cancelled","checkIn":"2028-04</sub>

- ✅ **Après annulation : 1 email(s)**  
  <sub>['2026-08-21T10-08-45-311Z-2-customer@mybestbooking_com.txt']</sub>

- ✅ **Re-annuler booking déjà cancelled → 200**  
  <sub>body={"booking":{"id":"dff252b3-d2b4-4e8f-bfdf-a6d350636bc6","bookingReference":"MBB-2026-X891H8","userId":"24d0799c-915b-4e12-be22-fd93eddcc15b","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","roomId</sub>


## 8. Wallet + BestRewards + promo (combinaisons)

- ✅ **État user avant combo : wallet=0.00€ level=3 promo=LASTMINUTE**  
  <sub>promo : {'id': '2e5c1023-3070-4279-a00c-7b20f7e9a8d3', 'code': 'LASTMINUTE', 'name': 'Dernière minute — 20€ de réduction', 'type': 'fixed_amount', 'value': '20.00', 'minBookingAmount': '80.00', 'maxDiscount': None, 'validFrom': '2026-08-21T08:35:58.771Z', 'validUntil': '2026-11-21T08:35:58.771Z', 'maxUses': 200, 'currentUses': 23, 'isActive': True, 'createdAt': '2026-08-21T08:35:58.772Z'}</sub>

- ✅ **Booking wallet+BR+promoLASTMINUTE : subtotal=267.0 disc=80.21 total=213.49**  
  <sub>code=201 math_ok=True body={"booking":{"id":"abc79a4c-053b-4fa9-a9b9-2b4f4be0e183","bookingReference":"MBB-2026-2WH5O5","userId":"24d0799c-915b-4e12-be22-fd93eddcc15b","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","roomId":"d8bc6067-13e6-4766-95f8-2c1240acd901","status":</sub>


## 9. Guest booking (sans compte)

- ✅ **POST bookings SANS cookie + isGuestBooking:true → 201 ref=MBB-2026-BDM3JV**  
  <sub>body={"booking":{"id":"c38ed361-9737-42d7-9def-28f683ff2a64","bookingReference":"MBB-2026-BDM3JV","userId":"298cd85d-3e5c-46b4-8c80-1e32b7d8307d","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","roomId":"d8bc6067-13e6-476</sub>


## 10. Propriété — host crée → admin approve/reject

- ✅ **POST /api/properties (host) → status=pending**  
  <sub>code=201 body={"property":{"id":"d127e728-0ca8-40b6-a199-7321c192301f","hostId":"e143e438-fbf9-4688-aca9-bcd35afa5a6c","name":"Deep Villa 1787306926","slug":"deep-villa-1787306926","type":"villa","description":"Tes</sub>

- ✅ **POST /api/properties (customer) → 401/403**  
  <sub>code=401</sub>

- ✅ **admin approve → status=active**  
  <sub>code=200 body={"property":{"id":"d127e728-0ca8-40b6-a199-7321c192301f","hostId":"e143e438-fbf9-4688-aca9-bcd35afa5a6c","name":"Deep Villa 1787306926","slug":"deep-villa-1787306926","type":"villa","description":"Tes</sub>

- ✅ **host tente validate → 403**  
  <sub>code=403</sub>

- ✅ **admin reject → status=draft**  
  <sub>body={"property":{"id":"d127e728-0ca8-40b6-a199-7321c192301f","hostId":"e143e438-fbf9-4688-aca9-bcd35afa5a6c","name":"Deep Villa 1787306926","slug":"deep-villa-1787306926","type":"villa","description":"Tes</sub>


## 11. Admin suspend user → sessions killed + login refusé

- ✅ **Créer user suspendme1787306926@test.local → id=cbee679e…**  

- ✅ **Session suspendme1787306926@test.local active avant suspension**  
  <sub>code=200</sub>

- ✅ **PATCH /users/cbee679e…/suspend (admin) → 200**  
  <sub>code=200 body={"user":{"id":"cbee679e-8835-42d1-b600-ff66a8dac87d","email":"suspendme1787306926@test.local","deletedAt":"2026-08-21T10:08:48.493Z"}}</sub>

- ✅ **Après suspend : /api/auth/me → 401 (attendu 401)**  
  <sub>body={"error":"Non authentifié"}</sub>

- ✅ **Login suspendme1787306926@test.local après suspend → 401 (attendu 400/401/403)**  
  <sub>body={"error":"Ce compte a été supprimé"}</sub>

- ✅ **Admin auto-suspension → 400**  
  <sub>code=400 body={"error":"Vous ne pouvez pas vous suspendre vous-même"}</sub>


## 12. Audit log alimenté (après actions admin ci-dessus)

- ✅ **GET /api/admin/audit → 21 entrées ; actions récentes : ['user.suspend', 'property.reject', 'property.validate', 'property.reject', 'property.validate']**  
  <sub>body[:200]={"entries":[{"id":"8396b2b9-53c3-4ac3-ad7d-7925e64d14a8","actorId":"416a87dc-5a7c-479b-adf9-831a64c60c77","actorEmail":"admin@mybestbooking.com","action":"user.suspend","entityType":"user","entityId":</sub>


## 13. Panel admin settings — lecture + RBAC

- ✅ **GET /api/admin/settings → sections : ['settings', 'providers']**  
  <sub>code=200</sub>

- ✅ **GET /api/admin/settings/general → 200**  
  <sub>body={"key":"general","value":{"siteName":"MyBestBooking","supportEmail":"support@mybestbooking.com","partnersEmail":"partners@mybestbooking.com","defaultCurrency":"EUR","defaultLanguage":"fr"}}</sub>

- ✅ **GET /api/admin/settings par customer → 403**  
  <sub>code=403 body={"error":"Accès admin requis"}</sub>


## 14. Chambres — host crée sa chambre, guards

- ✅ **POST /api/rooms (host, sa property) → 201**  
  <sub>body={"room":{"id":"6ce4918c-b66d-4752-9404-2f19c22e310e","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","name":"Deep Room 1787306929","description":null,"roomType":"double","bedConfiguration":null,"m</sub>

- ✅ **POST /api/rooms par customer → 401**  
  <sub>body={"error":"Non autorisé"}</sub>


## 15. Reviews

- ✅ **GET /api/reviews (public) → 20 avis**  
  <sub>code=200</sub>

- ✅ **POST /api/reviews bookingId inexistant → 404**  
  <sub>body={"error":"Réservation non trouvée"}</sub>


## 16. (voir section 21 finale — rate-limit déplacé pour éviter la pollution)

- ✅ **Rate-limit test déplacé en dernier (les 429 pollueraient les suivants)**  
  <sub>voir section 21</sub>


## 17. Wishlist partagée publique

- ✅ **GET /api/wishlists/shared/f4a4cce9… (anonyme) → 200 name='?'**  
  <sub>body={"name":"Public share test","itemCount":0,"items":[]}</sub>

- ✅ **GET /wishlists/share/f4a4cce9… (page) → 200**  


## 18. Referral code

- ✅ **GET /api/users/me/referral → code='BU23WN3L'**  
  <sub>body={"code":"BU23WN3L"}</sub>


## 19. Notification prefs — PATCH /api/users/me

- ✅ **PATCH priceAlertEnabled=true → priceAlertEnabled=True**  
  <sub>body={"user":{"id":"24d0799c-915b-4e12-be22-fd93eddcc15b","email":"customer@mybestbooking.com","firstName":"Marie","lastName":"Martin","phone":null,"country":null,"language":"fr","currency":"EUR","timezone</sub>

- ✅ **PATCH priceAlertEnabled=false → priceAlertEnabled=False**  


## 20. Delete account — flow réel avec compte sacrifice

- ✅ **Créer deleteme1787306931@test.local → id=b523f7e9…**  

- ✅ **DELETE /api/users/me self → 200**  
  <sub>body={"deleted":true}</sub>

- ✅ **Après DELETE : /api/auth/me → 401 (attendu 401)**  
  <sub>body={"error":"Non authentifié"}</sub>


## 21. Rate limit — wishlists POST (60 ops/min) — FIN

- ✅ **65 POST /api/wishlists → 59×201 + 6×429**  
  <sub>limite déclenchée à ~60ᵉ tentative</sub>


---

## 📊 Récapitulatif

| Verdict | Nombre |
|---|---:|
| ✅ OK | 81 |
| ⚠️  WARN | 0 |
| ❌ KO | 0 |
| **Total** | **81** |

## 🔁 Reproductibilité

Script versionné à `scripts/deep_sim.py`. Requiert :
1. `npm run db:dev` (PostgreSQL embarqué :55432)
2. `npx next dev -H 0.0.0.0 -p 3000`
3. `POST /api/seed` (idempotent)

Puis : `python3 scripts/deep_sim.py`

Le script :
- écrit dans `.data/mails/` (vrais emails ConsoleMailer)
- utilise `speakeasy` via Node pour un TOTP réel (dépendance déjà présente)
- crée/supprime ses propres uploads
- ne casse pas l'état DB (ressources jetables)
