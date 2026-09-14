import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingChatWidget } from "./booking-chat-widget";

vi.mock("@/components/ui-locale-provider", () => ({
  useT: () => (key: string) => {
    const labels: Record<string, string> = {
      "book.writeHost": "Écrire à l'hébergeur",
      "bookings.ref": "Réf.",
      "action.close": "Fermer",
      "loading.label": "Chargement en cours…",
      "settings.error": "Erreur",
      "book.openConvFail": "Impossible d'ouvrir la conversation",
      "contact.notFound": "Conversation introuvable",
      "error.retry": "Réessayer",
      "messages.emptyThread": "Envoyez votre premier message ci-dessous.",
    };
    return labels[key] ?? key;
  },
}));

vi.mock("@/components/message-composer", () => ({
  MessageComposer: () => <div data-testid="message-composer" />,
}));

vi.mock("@/components/message-attachment", () => ({
  MessageAttachment: () => null,
}));

describe("BookingChatWidget", () => {
  it("rend le chat flottant dans le coin inférieur gauche avec la référence de réservation", () => {
    const html = renderToStaticMarkup(
      <BookingChatWidget
        bookingId="00000000-0000-4000-8000-000000000001"
        propertyId="00000000-0000-4000-8000-000000000002"
        bookingReference="MBB-CHAT-001"
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("fixed");
    expect(html).toContain("bottom-4");
    expect(html).toContain("left-4");
    expect(html).toContain("MBB-CHAT-001");
    expect(html).toContain('aria-label="Fermer"');
  });
});
