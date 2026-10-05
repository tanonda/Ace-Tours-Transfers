import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 150;

/**
 * A header dropdown (Tours, Transfers, My Bookings) styled like the Radix
 * NavigationMenu it replaces. Each NavigationMenu root set state on mount and
 * re-rendered its subtree, ~114 components across the three on every page load
 * (also on phones, where the desktop nav is mounted but hidden). This holds no
 * state until someone uses it.
 *
 * Opens on hover (with a short grace period to cross the gap to the panel) or
 * click; closes on Escape (focus back to the button), when focus leaves, or when
 * a link inside is clicked.
 */
export function NavDropdown({
  label,
  triggerClassName,
  children,
}: {
  label: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-state={open ? "open" : "closed"}
        className={cn(navigationMenuTriggerStyle(), "group", triggerClassName)}
        onClick={() => setOpen((o) => !o)}
      >
        {label}{" "}
        <ChevronDown
          className="relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-50 mt-1.5 origin-top rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in-95"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
