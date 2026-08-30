# Conception — T-106 remédiation extrême

## Options

1. Patch local de chaque handler : faible coût, mais incohérences retries/crash. Rejeté.
2. États persistants additifs : inbox webhook, lease outbox, expiration payment, relation upload-message, quote annulation. Retenu.
3. Externaliser PMS/outbox : plus robuste mais dépendances et contrat non disponibles. Reporté.

## Architecture retenue

```text
Stripe event -> payment_event_inbox(unique provider event id)
  -> process pending events après booking commit

booking pending -> paymentExpiresAt -> cron cancel/provider + release promo

email_outbox pending/sending/sent/failed + claimedAt lease

upload_objects -> messageId (transaction atomique)

GET cancellation quote -> confirmation UI
```

Les promesses sans processus (SLA support, vérification avis) sont réalignées plutôt que simulées. Les migrations sont additives et les valeurs historiques gardent un comportement fallback.
