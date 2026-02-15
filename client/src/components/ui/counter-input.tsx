import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface CounterInputProps {
    value: number
    onValueChange: (value: number) => void
    min?: number
    max?: number
    label?: string
    className?: string
    inputClassName?: string
}

export function CounterInput({
    value,
    onValueChange,
    min = 0,
    max = 99,
    label,
    className,
    inputClassName,
}: CounterInputProps) {
    const handleIncrement = () => {
        if (value < max) {
            onValueChange(value + 1)
        }
    }

    const handleDecrement = () => {
        if (value > min) {
            onValueChange(value - 1)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value)
        if (!isNaN(newValue)) {
            if (newValue >= min && newValue <= max) {
                onValueChange(newValue)
            }
        } else if (e.target.value === "") {
            // Allow empty intermediate state, but maybe handle blur? 
            // For now, let's just not update parent if empty to avoid NaN
        }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value)
        if (isNaN(newValue) || newValue < min) {
            onValueChange(min)
        } else if (newValue > max) {
            onValueChange(max)
        }
    }

    return (
        <div className={cn("flex items-center space-x-2", className)}>
            <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-10 w-10 shrink-0 rounded-l-none"
                onClick={handleDecrement}
                disabled={value <= min}
                aria-label={`Decrease ${label || "value"}`}
            >
                <Minus className="h-4 w-4" />
            </Button>
            <div className="relative flex-1 min-w-[3rem]">
                <Input
                    type="number"
                    value={value}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={cn(
                        "text-center h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-900 font-semibold",
                        inputClassName
                    )}
                    min={min}
                    max={max}
                    aria-label={label}
                />
            </div>
            <Button
                variant="outline"
                size="icon"
                type="button"
                className="h-10 w-10 shrink-0 rounded-r-none"
                onClick={handleIncrement}
                disabled={value >= max}
                aria-label={`Increase ${label || "value"}`}
            >
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    )
}
