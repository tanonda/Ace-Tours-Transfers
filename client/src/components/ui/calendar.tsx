"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  return (
    <DayPicker
      numberOfMonths={props.numberOfMonths ?? (isDesktop ? 2 : 1)}
      pagedNavigation={props.pagedNavigation ?? true}
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-white group/calendar p-3 sm:p-5 md:p-6 lg:p-7 [--cell-size:3rem] sm:[--cell-size:3.5rem] md:[--cell-size:4.5rem] lg:[--cell-size:5rem] shadow-xl rounded-2xl w-fit xl:shadow-none [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-6 md:flex-row md:gap-8 lg:gap-12",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-5", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-10 w-10 sm:h-12 sm:w-12 rounded-full absolute left-0 select-none p-0 aria-disabled:opacity-50 hover:bg-gray-100",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-10 w-10 sm:h-12 sm:w-12 rounded-full absolute right-0 select-none p-0 aria-disabled:opacity-50 hover:bg-gray-100",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size] font-bold text-gray-900",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-[--cell-size] w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "bg-popover absolute inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-semibold",
          captionLayout === "label"
            ? "text-xl sm:text-2xl"
            : "[&>svg]:text-muted-foreground flex h-10 items-center gap-1 rounded-md pl-2 pr-1 text-base [&>svg]:size-4.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse mx-auto",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-gray-500 flex-1 select-none text-sm md:text-base font-bold pb-2 uppercase tracking-wider",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-[--cell-size] select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-full [&:last-child[data-selected=true]_button]:rounded-r-full [&>button]:rounded-full",
          defaultClassNames.day
        ),
        range_start: cn(
          "bg-[#e1f0fe] rounded-l-full",
          defaultClassNames.range_start
        ),
        range_middle: cn("bg-[#e1f0fe] rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-[#e1f0fe] rounded-r-full", defaultClassNames.range_end),
        today: cn(
          "text-blue-600 font-extrabold data-[selected=true]:text-white",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-[--cell-size] items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "rounded-full outline-offset-0 data-[selected-single=true]:bg-[#0052cc] data-[selected-single=true]:text-white data-[selected-single=true]:font-bold data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-gray-900 data-[range-start=true]:bg-[#0052cc] data-[range-start=true]:text-white data-[range-start=true]:font-bold data-[range-end=true]:bg-[#0052cc] data-[range-end=true]:text-white data-[range-end=true]:font-bold group-data-[focused=true]/day:border-[#0052cc] group-data-[focused=true]/day:ring-[#0052cc]/50 flex aspect-square h-auto w-full min-w-[--cell-size] min-h-[--cell-size] flex-col justify-center items-center gap-1 font-bold leading-none text-base md:text-[18px] lg:text-[20px] transition-colors data-[range-end=true]:rounded-full data-[range-middle=true]:rounded-full hover:data-[range-middle=true]:bg-blue-200 data-[range-start=true]:rounded-full group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70 touch-manipulation hover:bg-gray-100",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
