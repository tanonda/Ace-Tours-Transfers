import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type Invite = { firstName: string; items: { productId: string; productName: string; reviewed: boolean }[] };
type Draft = { rating: number; comment: string };

async function loadInvite(token: string): Promise<Invite | "expired"> {
  const res = await fetch(`/api/reviews/invite/${encodeURIComponent(token)}`, { credentials: "include" });
  if (res.status === 410) return "expired";
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

/** apiRequest throws Error("<status>: <body>") with a numeric `status` property. */
const errorStatus = (e: unknown): number | undefined => (e as { status?: number } | null)?.status;

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: (n: number) => string }) {
  return (
    <div role="radiogroup" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={label(n)}
          onClick={() => onChange(n)} className="p-1 focus-visible:outline focus-visible:outline-2 rounded">
          <Star className={`h-8 w-8 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

export default function ReviewInvite() {
  // Token lives in the URL fragment so it never reaches servers, Referer headers or analytics.
  const [token] = useState(() => {
    try { return decodeURIComponent(window.location.hash.slice(1)).trim(); } catch { return ""; }
  });
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const invite = useQuery({ queryKey: ["review-invite", token], queryFn: () => loadInvite(token), retry: false, enabled: token !== "" });

  const submit = useMutation({
    mutationFn: async () => {
      const reviews = Object.entries(drafts)
        .filter(([, d]) => d.rating > 0)
        .map(([productId, d]) => ({ productId, rating: d.rating, ...(d.comment.trim() ? { comment: d.comment.trim() } : {}) }));
      const res = await apiRequest("POST", `/api/reviews/invite/${encodeURIComponent(token)}`, { reviews });
      return res.json();
    },
  });

  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => {
      const cur: Draft = d[id] ?? { rating: 0, comment: "" };
      return { ...d, [id]: { ...cur, ...patch } };
    });
  const anyRated = Object.values(drafts).some((d) => d.rating > 0);

  let body: React.ReactNode;
  if (token === "") {
    body = (<><h1 className="text-2xl font-bold mb-2">{t("review.expiredTitle")}</h1><p>{t("review.expiredBody")}</p></>);
  } else if (invite.isLoading) {
    body = <p className="text-muted-foreground">…</p>;
  } else if (invite.data === "expired" || errorStatus(submit.error) === 410) {
    body = (<><h1 className="text-2xl font-bold mb-2">{t("review.expiredTitle")}</h1><p>{t("review.expiredBody")}</p></>);
  } else if (submit.isSuccess || errorStatus(submit.error) === 409) {
    body = (<><h1 className="text-2xl font-bold mb-2">{t("review.thanksTitle")}</h1><p>{t("review.thanksBody")}</p></>);
  } else if (invite.isError || !invite.data) {
    body = <p role="alert">{t("review.error")}</p>;
  } else {
    const data = invite.data;
    body = (
      <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">{t("review.title")}</h1>
          <p>{t("review.greeting", { name: data.firstName })}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("review.intro")}</p>
        </div>
        {data.items.map((item) => (
          <fieldset key={item.productId} className="border border-border rounded-lg p-4 space-y-3">
            <legend className="font-semibold px-1">{item.productName}</legend>
            {item.reviewed ? (
              <p className="text-sm text-muted-foreground">{t("review.alreadyReviewed")}</p>
            ) : (
              <>
                <Stars value={drafts[item.productId]?.rating ?? 0} onChange={(n) => set(item.productId, { rating: n })}
                  label={(n) => t("review.ratingLabel", { n })} />
                <label className="block text-sm">
                  {t("review.commentLabel")}
                  <Textarea maxLength={2000} className="mt-1" value={drafts[item.productId]?.comment ?? ""}
                    onChange={(e) => set(item.productId, { comment: e.target.value })} />
                </label>
              </>
            )}
          </fieldset>
        ))}
        {submit.isError && <p role="alert" className="text-destructive text-sm">{t("review.error")}</p>}
        <Button type="submit" disabled={!anyRated || submit.isPending}>{t("review.submit")}</Button>
      </form>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>{t("review.title")}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="max-w-xl mx-auto px-4 py-12">{body}</main>
    </Layout>
  );
}
