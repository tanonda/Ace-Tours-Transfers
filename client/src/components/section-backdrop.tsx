import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ImageCredit } from "@/lib/image-credits";

/**
 * SectionBackdrop: a photo-led section background.
 *
 * - "wash": the photo fills a band at the top and is faded out (by
 *   `washClassName`) into the section's base colour, so cards stay readable.
 * - "dark": the photo fills the whole section under a dark scrim, for
 *   white-text call-to-action strips.
 *
 * The section clips horizontally only (overflow-x-clip), so decorative
 * props can break out over the top/bottom edge without causing sideways
 * scroll on phones.
 */
interface SectionBackdropProps {
  photo: string;
  tone: "wash" | "dark";
  /** CSS object-position for the photo, e.g. "50% 60%". */
  photoPosition?: string;
  /** Gradient classes for the wash overlay (tone="wash" only). */
  washClassName?: string;
  credits: ImageCredit[];
  className?: string;
  children: ReactNode;
}

export function SectionBackdrop({
  photo,
  tone,
  photoPosition = "50% 50%",
  washClassName = "from-background/70 via-background/80 to-background",
  credits,
  className,
  children,
}: SectionBackdropProps) {
  return (
    <section className={cn("relative overflow-x-clip", className)}>
      <PhotoWash
        photo={photo}
        tone={tone}
        photoPosition={photoPosition}
        washClassName={washClassName}
        className={tone === "wash" ? "inset-x-0 top-0 h-[420px] md:h-[560px]" : "inset-0"}
      />

      <div className="container mx-auto px-4 relative">
        {children}
        <PhotoCredits credits={credits} tone={tone} />
      </div>
    </section>
  );
}

/**
 * The photo + overlay layer on its own, for areas that aren't a full
 * SectionBackdrop (e.g. one half of a split section). `className` sets its
 * absolute placement; the parent must be `relative`.
 */
export function PhotoWash({
  photo,
  tone,
  photoPosition = "50% 50%",
  washClassName = "from-background/70 via-background/80 to-background",
  className,
}: Pick<SectionBackdropProps, "photo" | "tone" | "photoPosition" | "washClassName" | "className">) {
  return (
    <div aria-hidden className={cn("absolute overflow-hidden", className)}>
      <img
        src={photo}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
        style={{ objectPosition: photoPosition }}
      />
      {tone === "wash" ? (
        <div className={cn("absolute inset-0 bg-gradient-to-b", washClassName)} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
      )}
    </div>
  );
}

export interface BackdropProp {
  src: string;
  /** Positioning/size/rotation classes, relative to the wrapped content. */
  className: string;
  /** Show on phones too (default: md and up only). */
  showOnMobile?: boolean;
}

/** Decorative cut-out images placed behind (and peeking out from) `children`. */
export function PropLayer({ props, children, className }: { props: BackdropProp[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {props.map((p, i) => (
        <img
          key={`${p.src}-${i}`}
          src={p.src}
          alt=""
          aria-hidden
          loading="lazy"
          className={cn(
            "pointer-events-none select-none absolute drop-shadow-xl",
            p.showOnMobile ? "block" : "hidden md:block",
            p.className,
          )}
        />
      ))}
      <div className="relative">{children}</div>
    </div>
  );
}

export function PhotoCredits({ credits, tone }: { credits: ImageCredit[]; tone: "wash" | "dark" }) {
  if (credits.length === 0) return null;
  return (
    <p
      className={cn(
        "mt-10 text-center text-xs leading-snug [&_*]:text-xs [&_a]:underline",
        tone === "dark" ? "text-white/55" : "text-foreground/50",
      )}
    >
      Photos:{" "}
      {credits.map((c, i) => (
        <span key={c.href}>
          <a href={c.href} target="_blank" rel="noopener noreferrer">{c.label}</a>, {c.author} ({c.license})
          {i < credits.length - 1 ? "; " : ". Adapted."}
        </span>
      ))}
    </p>
  );
}
