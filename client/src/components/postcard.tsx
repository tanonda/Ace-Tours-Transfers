/**
 * Postcard design language (design mock-up "A · Postcard"): numbered section
 * labels, polaroid photos with handwritten captions, and stamp-style price tags.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { splitPriceForStamp } from "@/lib/postcard-format";

/** "01 · ABOUT US" eyebrow with a rule; `centered` adds a rule on both sides. */
export function SectionLabel({
  index,
  children,
  tone = "primary",
  centered = false,
  className,
}: {
  index: number;
  children: ReactNode;
  tone?: "primary" | "reef" | "light";
  centered?: boolean;
  className?: string;
}) {
  const color = { primary: "text-primary", reef: "text-reef", light: "text-[#f3c9a8]" }[tone];
  const rule = <span aria-hidden className="h-px w-8 bg-current" />;
  return (
    <p className={cn("flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]", color, centered && "justify-center", className)}>
      {rule}
      <span>
        {String(index).padStart(2, "0")} · {children}
      </span>
      {centered && rule}
    </p>
  );
}

/** A white-framed instant photo, tilted, with a handwritten caption and optional tape. */
export function Polaroid({
  src,
  alt,
  caption,
  rotate = 0,
  tape = false,
  aspect = "aspect-[4/3]",
  className,
  objectPosition,
  contain = false,
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  rotate?: number;
  tape?: boolean;
  aspect?: string;
  className?: string;
  objectPosition?: string;
  /** For cut-out objects on transparent backgrounds: show the whole object on white. */
  contain?: boolean;
}) {
  return (
    <figure
      className={cn(
        "relative bg-white p-3 pb-4 shadow-[0_18px_40px_-12px_rgba(18,50,74,0.35)] transition-transform duration-500",
        "rotate-(--tilt) hover:rotate-0 hover:-translate-y-1",
        className,
      )}
      style={{ "--tilt": `${rotate}deg` } as CSSProperties}
    >
      {tape && (
        <span
          aria-hidden
          className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 -rotate-6 bg-primary/55 shadow-sm"
        />
      )}
      <div className={cn("overflow-hidden", contain ? "bg-white p-4" : "bg-muted", aspect)}>
        <img src={src} alt={alt} loading="lazy" decoding="async" className={cn("h-full w-full", contain ? "object-contain" : "object-cover")} style={{ objectPosition }} />
      </div>
      {caption && (
        <figcaption className="font-script text-xl md:text-2xl text-navy mt-3 px-1 leading-none">{caption}</figcaption>
      )}
    </figure>
  );
}

/** Dashed postage-stamp price tag: "FROM / VT / 9,600". */
export function PriceStamp({ label, price, className }: { label: string; price: string; className?: string }) {
  const lines = splitPriceForStamp(price);
  return (
    <div
      className={cn(
        "bg-paper px-2.5 py-2 text-center text-primary shadow-md rotate-3",
        "outline-2 outline-dashed outline-primary -outline-offset-[5px]",
        className,
      )}
    >
      <span className="block text-[0.6rem] font-bold uppercase tracking-[0.15em]">{label}</span>
      {lines.map((line) => (
        <span key={line} className="block font-serif text-xl leading-tight">{line}</span>
      ))}
    </div>
  );
}
