import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button feedback follows one rule: the interface responds on pointer-down.
 *
 * - Hover only changes colour (no grow/lift). A control that floats toward the
 *   cursor reads as decoration, not as something you press.
 * - Press is a 3% scale-down committed in ~100ms, then released. It is the
 *   confirmation that the tap landed, before the action itself completes.
 * - Only colour/shadow/transform animate; nothing here animates layout.
 * - Reduced-motion users keep the colour change and lose the scale.
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.97] active:duration-100 motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border shadow-sm hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive-border shadow-sm hover:bg-destructive/90",
        outline:
          "border [border-color:var(--button-outline)] bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border bg-secondary text-secondary-foreground border-secondary-border shadow-sm hover:bg-secondary/80",
        ghost: "border border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        // 40px visual, expanding to the 44px touch target via a transparent
        // hit-area rather than by growing the header's layout box.
        icon: "h-10 w-10 before:absolute before:-inset-0.5 before:content-[''] relative",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
