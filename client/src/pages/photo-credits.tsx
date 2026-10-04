import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useTranslation } from "react-i18next";
import { useCmsText } from "@/hooks/use-cms-text";
import { photoCredits } from "@/lib/site-photos";

/**
 * Attribution for the openly licensed photos on the site. Credits live here
 * (linked from the footer) instead of on the content pages. Built from the
 * live photo slots, so a photo replaced in Admin → CMS drops off the list
 * unless the admin entered a credit for it.
 */
export default function PhotoCredits() {
  const { t } = useTranslation();
  // One query serves every block; each call just reads its block.
  const blocks: Record<string, ReturnType<typeof useCmsText>> = {
    "home-page": useCmsText("home-page"),
    "tours-page": useCmsText("tours-page"),
    "transfers-page": useCmsText("transfers-page"),
    about: useCmsText("about"),
    contact: useCmsText("contact"),
    "manage-booking": useCmsText("manage-booking"),
    footer: useCmsText("footer"),
  };
  const credits = photoCredits((block, key) => blocks[block]?.text(key) ?? "");

  return (
    <Layout>
      <SEO
        title="Photo Credits — Ace Tours & Transfers Vanuatu"
        description="Credits and licences for the photographs used on the Ace Tours & Transfers website."
      />
      <div className="bg-background pt-header-page pb-20">
        <div className="container mx-auto max-w-3xl px-4">
          <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <span aria-hidden className="h-px w-8 bg-current" />
            {t("credits.label", "Thank you")}
          </p>
          <h1 className="mb-4 text-4xl text-navy md:text-5xl">{t("credits.title", "Photo credits")}</h1>
          <p className="mb-10 text-muted-foreground">
            {t("credits.intro", "Photos of Efate used on this site are shared by their photographers under Creative Commons licences. Some have been cropped or colour-graded.")}
          </p>
          <ul className="divide-y divide-border border-y border-border">
            {credits.map((c) => (
              <li key={c.src} className="flex items-center gap-4 py-4">
                <img src={c.src} alt="" loading="lazy" className="size-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 text-sm">
                  {c.credit ? (
                    <p className="text-navy">
                      <a href={c.credit.href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                        {c.credit.label}
                      </a>
                      {" — "}{c.credit.author} ({c.credit.license})
                    </p>
                  ) : (
                    <p className="text-navy">{c.text}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.usedOn.join(" · ")}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
