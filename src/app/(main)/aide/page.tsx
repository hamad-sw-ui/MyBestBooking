import type { Metadata } from "next";
import { HelpCenter } from "@/components/help-center";

export const metadata: Metadata = {
  title: "Aide et FAQ",
  description: "Trouvez des réponses concrètes à vos questions de réservation, paiement, compte et hébergement.",
};

export default function HelpPage() {
  return <HelpCenter />;
}
