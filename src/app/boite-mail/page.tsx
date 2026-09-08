import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/auth";
import { getServerLocale } from "@/lib/server-locale";
import { getInboxMail, isDevMailInboxEnabled, listInboxMails } from "@/lib/mail/inbox";

export const dynamic = "force-dynamic";

export default async function BoiteMailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!isDevMailInboxEnabled()) notFound();

  const { id } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  const locale = await getServerLocale();
  const mails = listInboxMails();
  const selected = id ? getInboxMail(id) : mails[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} initialLanguage={locale} />
      <main id="main-content" className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-[#1B3A6B] mb-2">Boîte mail (développement)</h1>
        <p className="text-sm text-gray-600 mb-6">
          Sans clé Resend, chaque e-mail transactionnel est écrit ici. Inscrivez-vous
          ou demandez un mot de passe : le message et ses liens apparaissent ci-dessous.
        </p>
        {mails.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-gray-500">
            Aucun e-mail pour l&apos;instant. Créez un compte sur{" "}
            <Link href="/inscription" className="text-[#FF5A5F] underline">
              /inscription
            </Link>{" "}
            pour en générer un.
          </div>
        ) : (
          <div className="grid md:grid-cols-[280px_1fr] gap-4">
            <ul className="bg-white rounded-xl border divide-y max-h-[70vh] overflow-auto">
              {mails.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/boite-mail?id=${encodeURIComponent(m.id)}`}
                    className={`block p-3 hover:bg-gray-50 ${selected?.id === m.id ? "bg-[#1B3A6B]/5" : ""}`}
                  >
                    <div className="text-xs text-gray-500 truncate">{m.to}</div>
                    <div className="font-medium text-sm text-gray-900 truncate">{m.subject}</div>
                    <div className="text-xs text-gray-400">{m.date}</div>
                  </Link>
                </li>
              ))}
            </ul>
            {selected && (
              <article className="bg-white rounded-xl border p-6">
                <p className="text-sm text-gray-500">À : {selected.to}</p>
                <h2 className="text-xl font-semibold mt-1 mb-4">{selected.subject}</h2>
                {selected.links.length > 0 && (
                  <div className="mb-4 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Liens cliquables</p>
                    {selected.links.map((href) => (
                      <a
                        key={href}
                        href={href}
                        className="block text-sm text-[#FF5A5F] break-all underline"
                      >
                        {href}
                      </a>
                    ))}
                  </div>
                )}
                {selected.html ? (
                  <iframe
                    title="Aperçu HTML"
                    className="w-full min-h-[420px] border rounded-lg bg-[#f8f9fa]"
                    srcDoc={selected.html}
                    sandbox=""
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{selected.text}</pre>
                )}
              </article>
            )}
          </div>
        )}
      </main>
      <Footer userRole={user?.role ?? null} />
    </div>
  );
}
