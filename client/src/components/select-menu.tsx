import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SelectMenuItem {
  value: string;
  content: ReactNode;
}

export interface SelectMenuGroup {
  label?: string;
  items: SelectMenuItem[];
}

/**
 * A "pick one" menu button (language, currency). It replaces a Radix DropdownMenu,
 * whose Popper re-rendered once on every page load to record the button's position;
 * this holds no state until it is opened, and measures the button only then.
 *
 * Accessible as a menu button: aria-haspopup/aria-expanded on the button, role=menu
 * with menuitemradio + aria-checked items. Focus starts on the current choice;
 * arrows (wrapping), Home and End move; Enter/Space selects; Escape and Tab close;
 * focus returns to the button. The panel is portalled to <body> (or into the modal
 * dialog it sits in) so a scrolling container like the phone menu can't clip it.
 */
export function SelectMenu({
  value,
  onSelect,
  groups,
  triggerContent,
  ariaLabel,
  testId,
  triggerClassName,
  menuClassName,
}: {
  value: string;
  onSelect: (value: string) => void;
  groups: SelectMenuGroup[];
  triggerContent: ReactNode;
  ariaLabel: string;
  testId?: string;
  triggerClassName?: string;
  menuClassName?: string;
}) {
  // Where the panel is and which element it is portalled into (null while closed).
  const [placement, setPlacement] = useState<{ style: CSSProperties; host: HTMLElement } | null>(null);
  const open = placement !== null;
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const trigger = triggerRef.current!;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const openUp = below < 240 && rect.top > below;
    const vertical = openUp ? { maxHeight: rect.top - 12 } : { maxHeight: below - 12 };
    // A modal dialog (the phone menu) blocks clicks outside itself, so the panel goes
    // inside it, positioned relative to it; otherwise it goes on <body>.
    const dialog = trigger.closest<HTMLElement>('[role="dialog"]');
    if (dialog) {
      const box = dialog.getBoundingClientRect();
      setPlacement({
        host: dialog,
        style: {
          position: "absolute",
          right: Math.max(8, box.right - rect.right),
          ...(openUp ? { bottom: box.bottom - rect.top + 4 } : { top: rect.bottom - box.top + 4 }),
          ...vertical,
        },
      });
    } else {
      setPlacement({
        host: document.body,
        style: {
          position: "fixed",
          right: Math.max(8, window.innerWidth - rect.right),
          ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
          ...vertical,
        },
      });
    }
  };
  const close = (refocus: boolean) => {
    setPlacement(null);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (next: string) => {
    onSelect(next);
    close(true);
  };

  const itemEls = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];

  // Focus the current choice as the menu appears.
  useLayoutEffect(() => {
    if (!open) return;
    const items = itemEls();
    (items.find((el) => el.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
  }, [open]);

  // While open: close on a click outside; follow the button when the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    const onMove = () => place();
    // Caught before a surrounding Radix dialog (which listens on document in the
    // capture phase), so Escape closes only this menu.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    window.addEventListener("keydown", onEscape, true);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemEls();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); focusAt(at + 1); break;
      case "ArrowUp": e.preventDefault(); focusAt(at - 1); break;
      case "Home": e.preventDefault(); focusAt(0); break;
      case "End": e.preventDefault(); focusAt(items.length - 1); break;
      case "Escape": e.preventDefault(); close(true); break;
      case "Tab": e.preventDefault(); close(true); break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const chosen = (document.activeElement as HTMLElement | null)?.dataset.value;
        if (chosen) choose(chosen);
        break;
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        data-testid={testId}
        data-state={open ? "open" : "closed"}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex items-center gap-1.5 h-9 px-2.5 font-medium text-sm", triggerClassName)}
        onClick={() => (open ? close(false) : place())}
      >
        {triggerContent}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          style={placement.style}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "z-[100] min-w-[8rem] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
            menuClassName,
          )}
        >
          {groups.map((group, g) => (
            <div key={g} role="group" aria-label={group.label}>
              {g > 0 && <div className="-mx-1 my-1 h-px bg-muted" role="separator" />}
              {group.label && (
                <div className="px-2 pt-1.5 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const checked = item.value === value;
                return (
                  <div
                    key={item.value}
                    role="menuitemradio"
                    aria-checked={checked}
                    tabIndex={-1}
                    data-value={item.value}
                    onClick={() => choose(item.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      checked && "bg-accent/60",
                    )}
                  >
                    <span className="flex items-center gap-2">{item.content}</span>
                    {checked && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        placement.host,
      )}
    </>
  );
}
