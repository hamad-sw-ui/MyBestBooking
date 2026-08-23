# Opportunités — T-107

| Opportunité | Valeur | Décision |
|---|---|---|
| tableau admin des remboursements/email en attente | exploitation et support plus rapides | backlog : à concevoir avec rôles/SLA |
| worker dédié / queue durable | retries, métriques et backoff distribué | reporté : le cron persistant couvre le périmètre actuel |
| quote unique également dans le checkout UI | cohérence prix affiché/serveur | reporté : serveur reste autorité; nécessite contrat de devis signé |
| alertes multi-devises converties | seuils utiles internationalement | reporté : aucune source FX fiable ni politique de conversion |
| ticket de réimport de pièces jointes historiques | accès aux anciens fichiers privés | backlog : nécessite source d’archive et consentement |
| nouvelle clé identifiée par `key_id` en DB | audits de rotation avancés | reporté : keyring temporaire + rechiffrement explicite suffisent sans persister d’identité de secret |
