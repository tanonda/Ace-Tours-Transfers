/**
 * Full-bleed photo hero used by Home, Tours, Transfers and About.
 *
 * Text treatment follows the user's reference: a centred, wide-spaced uppercase
 * kicker over one very large bold headline whose letters fade from solid white
 * into the photo, so the words sit inside the picture. A torn-paper edge joins
 * the hero to the cream page below.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PaperEdge } from "@/components/postcard";
import { cloudinaryOpt } from "@/components/seo";

export function PageHero({
  photo,
  photoPosition = "50% 50%",
  greeting,
  kicker,
  title,
  subtitle,
  children,
  size = "page",
  as: Heading = "h1",
  priority = false,
}: {
  photo: string;
  photoPosition?: string;
  /** Brush-lettered greeting above the heading, e.g. "Greetings from Port Vila!". */
  greeting?: ReactNode;
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Content under the headline: the booking widget on Home, nothing on inner pages. */
  children?: ReactNode;
  /** "home" fills the screen (capped so the booking widget stays in view); "page" is a shorter banner. */
  size?: "home" | "page";
  as?: "h1" | "h2";
  /** Load the photo eagerly with high priority (it is the page's largest image). */
  priority?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative w-full overflow-hidden bg-harbour",
        size === "home" ? "md:h-[100svh] md:min-h-[600px] md:max-h-[880px]" : "min-h-[440px] md:min-h-[520px]",
      )}
    >
      <div aria-hidden className="absolute inset-0">
        <img
          src={photo.includes("res.cloudinary.com") ? cloudinaryOpt(photo, 1920) : photo}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: photoPosition }}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
        {/* Darken the top (header + kicker) and centre (headline) just enough for white text. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-background/60" />
      </div>

      <div
        className={cn(
          "relative container mx-auto flex h-full flex-col items-center px-4 text-center",
          size === "home" ? "justify-end pt-48 pb-12 md:pt-32 md:pb-16" : "justify-center pt-48 pb-28 md:pt-44 md:pb-24",
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-white"
        >
          {/* Kicker and headline form ONE heading, so search engines read the full phrase
              ("Efate Island Day Tours") while the eye sees a small line over a big word. */}
          {greeting && (
            <p className="mb-3 -rotate-3 font-brush text-[2rem] leading-tight text-[#ffe3c6] [text-shadow:0_3px_14px_rgba(0,0,0,0.45)] sm:text-[2.4rem] md:mb-5 md:text-[clamp(2.6rem,min(4.6vw,7vh),4.25rem)]">
              {greeting}
            </p>
          )}
          <Heading className="font-sans">
            {kicker && (
              <span className="mb-1 block text-sm font-semibold uppercase tracking-[0.28em] text-white drop-shadow md:text-xl">
                {kicker}{" "}
              </span>
            )}
            <span
              className={cn(
                "hero-fade-text block font-bold tracking-tight leading-[0.95]",
                size === "home"
                  ? "text-[3.4rem] sm:text-7xl md:text-[clamp(3.6rem,min(8vw,11vh),8rem)]"
                  : "text-6xl sm:text-7xl md:text-[clamp(4.5rem,9vw,8rem)]",
              )}
            >
              {title}
            </span>
          </Heading>
          {subtitle && <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] md:text-lg">{subtitle}</p>}
        </motion.div>

        {children && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
            // On laptops the floating social/WhatsApp buttons sit at the right edge; keep the
            // widget clear of them until the screen is wide enough to leave a natural margin.
            className="z-20 mt-8 w-full text-left md:mt-10 md:pr-20 min-[1500px]:pr-0"
          >
            {children}
          </motion.div>
        )}
      </div>

      <PaperEdge position="bottom" seed={3} />
    </section>
  );
}
