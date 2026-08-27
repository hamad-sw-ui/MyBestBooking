-- T-123 (G2) : le JWT de session embarque désormais le rôle en plus de
-- userId. Le token signé approche/dépasse 255 caractères selon les claims
-- (jti + role) ; on fait passer la colonne de varchar(255) à text pour
-- éviter l'erreur 22001 (value too long) à la connexion. Sans perte de
-- données : text accepte toutes les valeurs déjà présentes.
ALTER TABLE "sessions" ALTER COLUMN "token" TYPE text;
