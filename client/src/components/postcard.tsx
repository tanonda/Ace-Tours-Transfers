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
      {/* The frame is always white, so the caption keeps dark ink in both themes. */}
      {caption && (
        <figcaption className="font-script text-xl md:text-2xl text-[#12324a] mt-3 px-1 leading-none">{caption}</figcaption>
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

// ─── Torn paper edges ─────────────────────────────────────────────────────────

/** Small deterministic PRNG: the same seed draws the same tear on the server and in the browser. */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EDGE_W = 1440;
const EDGE_H = 48;

/** A jagged line across the edge: small fibres plus the odd deeper rip, filled down to the bottom. */
export function tornEdgePath(seed: number, baseline = 22, roughness = 9): string {
  const rand = seededRandom(seed);
  let x = 0;
  let d = `M0,${EDGE_H} L0,${baseline}`;
  while (x < EDGE_W) {
    x = Math.min(EDGE_W, x + 6 + rand() * 18);
    const rip = rand() < 0.08 ? (rand() - 0.3) * roughness * 2.2 : 0;
    const y = baseline + (rand() - 0.5) * roughness + rip;
    d += ` L${x.toFixed(1)},${Math.max(2, Math.min(EDGE_H - 2, y)).toFixed(1)}`;
  }
  return `${d} L${EDGE_W},${EDGE_H} Z`;
}

/**
 * Torn-paper boundary between two sections. Place it inside the section it
 * overlaps (which must be `relative`): `position="bottom"` tears the NEXT
 * section's paper up over this one; `position="top"` hangs the PREVIOUS
 * section's paper down into this one. `color` is that neighbouring paper.
 */
export function PaperEdge({
  position,
  color = "hsl(var(--background))",
  seed = 1,
  className,
}: {
  position: "top" | "bottom";
  color?: string;
  seed?: number;
  className?: string;
}) {
  const fibre = tornEdgePath(seed, 20, 10);
  const paper = tornEdgePath(seed + 101, 25, 8);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${EDGE_W} ${EDGE_H}`}
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-7 w-full md:h-10",
        position === "bottom" ? "bottom-0 translate-y-px" : "top-0 -translate-y-px -scale-y-100",
        className,
      )}
    >
      {/* The torn fibre: a pale ragged strip just beyond the coloured paper. */}
      <path d={fibre} fill="hsl(var(--paper))" opacity={0.85} style={{ filter: "drop-shadow(0 -2px 3px rgba(0,0,0,0.18))" }} />
      <path d={paper} fill={color} />
    </svg>
  );
}
