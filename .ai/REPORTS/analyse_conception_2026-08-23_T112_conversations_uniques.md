# Conception — T-112

Ajouter `conversations.conversation_key` unique. Le handler insère avec
`onConflictDoNothing`, puis relit la clé. La clé ne dépend pas du navigateur et
ne peut pas être falsifiée : elle est calculée après validation property/booking.
Les conversations anciennes sont backfillées par migration SQL additive.
