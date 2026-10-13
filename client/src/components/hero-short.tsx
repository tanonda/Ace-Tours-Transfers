/**
 * The admin's YouTube / Instagram / Facebook Short in a hero.
 *
 * Desktop: a 9:16 "phone" card beside the headline. Mobile: a "Watch our video" pill
 * that opens the player in a dialog. Both are pure CSS switches (hydration-safe). The
 * platform player (and its scripts and cookies) loads only after a click.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SHORT_PLATFORM_NAME, type HeroShortData } from "@shared/hero-video";

function ShortPlayer({ short, title }: { short: HeroShortData; title: string }) {
  return (
    <iframe
      src={short.embedUrl}
      title={title}
      className="h-full w-full border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function ShortCover({ short }: { short: HeroShortData }) {
  const src = short.cover ?? short.thumbnailUrl;
  if (src) return <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />;
  return (
    <span className="absolute inset-0 flex items-start justify-center bg-gradient-to-br from-[#12324a] via-[#1d5a73] to-primary pt-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/90">
      {SHORT_PLATFORM_NAME[short.platform]}
    </span>
  );
}

export function HeroShort({ short }: { short: HeroShortData }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const label = t("hero.watchVideo", "Watch our video");
  const platform = SHORT_PLATFORM_NAME[short.platform];
  const watchOn = t("hero.watchOn", { platform, defaultValue: "Watch on {{platform}}" });
  const watchLink = (
    <a href={short.watchUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-xs font-medium text-white/85 underline underline-offset-2 hover:text-white">
      {watchOn}
    </a>
  );

  return (
    <>
      {/* Desktop: phone card */}
      <div className="hidden md:block">
        <div className="relative aspect-[9/16] w-[190px] overflow-hidden rounded-[1.75rem] border-4 border-white/85 bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] lg:w-[220px]">
          {playing ? (
            <ShortPlayer short={short} title={label} />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} aria-label={`${label} (${platform})`} className="group absolute inset-0 text-white">
              <ShortCover short={short} />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#12324a] shadow-lg transition-transform group-hover:scale-110">
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </span>
              <span className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold">{label}</span>
            </button>
          )}
        </div>
        {watchLink}
      </div>

      {/* Mobile: pill + dialog */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#12324a] shadow-lg"
        >
          <Play className="h-4 w-4 fill-current" />
          {label}
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-[min(92vw,380px)] max-w-none border-0 bg-black p-3">
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-lg">{open && <ShortPlayer short={short} title={label} />}</div>
            {watchLink}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
