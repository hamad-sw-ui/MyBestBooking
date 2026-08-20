/**
 * Templates d'emails MyBestBooking (T-013).
 * HTML minimal sans framework. Version texte générée par stripHtml.
 */

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

const brand = {
  primary: "#1B3A6B",
  secondary: "#FF5A5F",
  bg: "#f8f9fa",
};

function layout(inner: string): string {
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;font-family:Inter,system-ui,sans-serif;background:${brand.bg};color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:${brand.primary};font-weight:700;font-size:20px;">mybest</span><span style="color:${brand.secondary};font-weight:700;font-size:20px;">booking</span>
    </div>
    ${inner}
    <hr style="margin-top:32px;border:none;border-top:1px solid #eee;">
    <p style="font-size:12px;color:#888;text-align:center;">MyBestBooking — Réservez mieux. Voyagez plus.</p>
  </div>
</body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 24px;background:${brand.secondary};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>`;
}

export const templates = {
  emailVerification({ firstName, url }: { firstName: string; url: string }) {
    const html = layout(`
      <h1 style="margin:0 0 16px 0;font-size:22px;">Bienvenue ${firstName} 👋</h1>
      <p>Merci d'avoir créé votre compte MyBestBooking. Il ne reste qu'à confirmer votre adresse email pour commencer à réserver.</p>
      <p style="margin:24px 0;">${button(url, "Vérifier mon email")}</p>
      <p style="font-size:13px;color:#666;">Ou copiez-collez ce lien dans votre navigateur :<br><span style="word-break:break-all;">${url}</span></p>
      <p style="font-size:13px;color:#666;">Ce lien expire dans 24 heures.</p>
    `);
    return { subject: "Vérifiez votre email — MyBestBooking", html, text: stripHtml(html) };
  },

  passwordReset({ firstName, url }: { firstName: string; url: string }) {
    const html = layout(`
      <h1 style="margin:0 0 16px 0;font-size:22px;">Réinitialisation du mot de passe</h1>
      <p>Bonjour ${firstName}, vous avez demandé à réinitialiser votre mot de passe.</p>
      <p style="margin:24px 0;">${button(url, "Choisir un nouveau mot de passe")}</p>
      <p style="font-size:13px;color:#666;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    `);
    return { subject: "Réinitialiser votre mot de passe — MyBestBooking", html, text: stripHtml(html) };
  },

  bookingConfirmation({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    city: string; checkIn: string; checkOut: string; total: string; currency: string;
  }) {
    const html = layout(`
      <h1 style="margin:0 0 16px 0;font-size:22px;">Réservation confirmée ✅</h1>
      <p>Bonjour ${firstName}, votre réservation est confirmée.</p>
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">Référence</td><td style="padding:8px 0;text-align:right;font-weight:600;">${bookingReference}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Hébergement</td><td style="padding:8px 0;text-align:right;">${propertyName}, ${city}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Arrivée</td><td style="padding:8px 0;text-align:right;">${checkIn}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Départ</td><td style="padding:8px 0;text-align:right;">${checkOut}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Total</td><td style="padding:8px 0;text-align:right;font-weight:600;">${total} ${currency}</td></tr>
      </table>
      <p>Bon voyage !</p>
    `);
    return { subject: `Réservation confirmée ${bookingReference}`, html, text: stripHtml(html) };
  },

  bookingHostNotification({
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string;
  }) {
    const html = layout(`
      <h1 style="margin:0 0 16px 0;font-size:22px;">Nouvelle réservation 🎉</h1>
      <p>Bonjour ${hostFirstName}, une nouvelle réservation vient d'être confirmée sur votre hébergement.</p>
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">Référence</td><td style="padding:8px 0;text-align:right;font-weight:600;">${bookingReference}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Hébergement</td><td style="padding:8px 0;text-align:right;">${propertyName}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Voyageur</td><td style="padding:8px 0;text-align:right;">${guestName}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Arrivée</td><td style="padding:8px 0;text-align:right;">${checkIn}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Départ</td><td style="padding:8px 0;text-align:right;">${checkOut}</td></tr>
      </table>
      <p>Consultez le détail dans votre <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/bookings">dashboard</a>.</p>
    `);
    return { subject: `Nouvelle réservation ${bookingReference}`, html, text: stripHtml(html) };
  },
};
