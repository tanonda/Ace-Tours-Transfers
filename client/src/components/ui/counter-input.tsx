import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, Variants } from "framer-motion"

interface CounterInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: number
    onValueChange: (value: number) => void
    min?: number
    max?: number
    label?: string
    className?: string
    inputClassName?: string
}

export const CounterInput = React.forwardRef<HTMLInputElement, CounterInputProps>(({
    value,
    onValueChange,
    min = 0,
    max = 99,
    label,
    className,
    inputClassName,
    id,
    name,
    ...props
}, ref) => {
    const [direction, setDirection] = React.useState(0);

    const handleIncrement = () => {
        if (value < max) {
            setDirection(1);
            onValueChange(value + 1)
        }
    }

    const handleDecrement = () => {
        if (value > min) {
            setDirection(-1);
            onValueChange(value - 1)
        }
    }

    const variants: Variants = {
        initial: (d: number) => ({
            y: d > 0 ? 20 : d < 0 ? -20 : 0,
            opacity: 0,
            scale: 0.8
        }),
        animate: {
            y: 0,
            opacity: 1,
            scale: 1,
            transition: { type: "spring", stiffness: 300, damping: 30 }
        },
        exit: (d: number) => ({
            y: d > 0 ? -20 : d < 0 ? 20 : 0,
            opacity: 0,
            scale: 0.8,
            transition: { duration: 0.2 }
        })
    };

    return (
        <div className={cn("flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm", className)}>
            {/* Hidden real input for form submission and accessibility focus */}
            <input
                type="hidden"
                id={id}
                name={name}
                value={value}
                ref={ref}
                {...props}
            />

            <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-10 w-10 shrink-0 rounded-none hover:bg-slate-50 border-r border-slate-100 disabled:opacity-30"
                onClick={handleDecrement}
                disabled={value <= min}
                aria-label={`Decrease ${label || "value"}`}
            >
                <Minus className="h-4 w-4 text-slate-600" />
            </Button>

            <div className="relative flex-1 min-w-[3rem] h-10 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="popLayout" custom={direction}>
                    <motion.span
                        key={value}
                        custom={direction}
                        variants={variants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={cn(
                            "text-center font-bold text-lg text-slate-900 select-none",
                            inputClassName
                        )}
                    >
                        {value}
                    </motion.span>
                </AnimatePresence>
            </div>

            <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-10 w-10 shrink-0 rounded-none hover:bg-slate-50 border-l border-slate-100 disabled:opacity-30"
                onClick={handleIncrement}
                disabled={value >= max}
                aria-label={`Increase ${label || "value"}`}
            >
                <Plus className="h-4 w-4 text-slate-600" />
            </Button>
        </div>
    )
})
CounterInput.displayName = "CounterInput"
