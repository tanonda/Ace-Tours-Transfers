"use client";
import React from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface Slot {
    time: string;
    available: boolean;
    remaining: number;
}

interface TimeSlotPickerProps {
    slots: Slot[];
    selectedTime: string | null;
    onSelect: (time: string) => void;
    isLoading?: boolean;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
    slots,
    selectedTime,
    onSelect,
    isLoading
}) => {
    if (isLoading) {
        return (
            <div className="mt-4 animate-pulse space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-10 bg-gray-100 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (slots.length === 0) {
        return null;
    }

    return (
        <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Clock className="w-4 h-4" />
                <span>Select Time</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => (
                    <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? "default" : "outline"}
                        className={cn(
                            "h-auto py-2 px-1 text-sm flex flex-col items-center justify-center gap-0.5",
                            !slot.available && "opacity-50 cursor-not-allowed bg-gray-50",
                            selectedTime === slot.time && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => slot.available && onSelect(slot.time)}
                        disabled={!slot.available}
                        title={slot.available ? `${slot.remaining} seats left` : "Full"}
                    >
                        <span>{slot.time}</span>
                        <span className="text-[10px] font-normal opacity-80">
                            {slot.available ? `${slot.remaining} left` : "Full"}
                        </span>
                    </Button>
                ))}
            </div>
        </div>
    );
};
