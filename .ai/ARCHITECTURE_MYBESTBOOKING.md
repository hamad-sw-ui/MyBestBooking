# Architecture réelle MyBestBooking

## Runtime

MyBestBooking est une application Next.js 16 utilisant l'App Router et React
19. Les Server Components lisent PostgreSQL via Drizzle ORM ; les composants
Client gèrent les formulaires, états de chargement et interactions navigateur.

## Domaines

- `src/app/api/auth` : sessions JWT, 2FA TOTP et comptes.
- `src/app/api/properties` : hébergements, chambres et disponibilité.
- `src/app/api/bookings` : réservation, capacité, paiement et annulation.
- `src/app/api/reviews` : avis vérifiés et modération.
- `src/app/api/wishlists` : favoris et partage.
- `src/app/dashboard` : interfaces admin et hôte.
- `src/db` : schéma PostgreSQL et pool Drizzle partagé.

## Principes

Les contrôles d'autorisation, de disponibilité et de transition restent côté
API. L'interface ne doit jamais être la seule protection. Toute action visible
doit exposer son état de chargement et son erreur de manière actionnable.
