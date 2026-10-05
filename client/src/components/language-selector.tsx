// A Radix DropdownMenu styled like the Shadcn Select it replaced (which itself replaced
// a native <select> for dark-mode consistency, Fix #24). A Select has to mount every
// option just to show the chosen one's label, so it re-rendered on every page load and
// prerendered with an empty button. Here the label comes straight from i18n and the
// options mount only when the menu opens.
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, Globe } from "lucide-react";

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'bi', name: 'Bislama' },
  { code: 'zh', name: '中文' },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = languages.find((l) => l.code === i18n.language)
    ?? languages.find((l) => i18n.language?.startsWith(l.code))
    ?? languages[0];

  return (
    <DropdownMenu modal={false}>
      {/* Same ghost button style as the currency selector beside it: it takes the colour
          of the bar it sits in (white over the home hero), with no box of its own.
          The classes go straight on the trigger: wrapping it in <Button asChild> adds
          components to Radix's mount-time anchoring re-render. */}
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex items-center gap-1.5 h-9 px-2.5 font-medium text-sm")}
        aria-label="Select language"
        data-testid="select-language"
      >
        <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span>{current.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current.code} onValueChange={(value) => i18n.changeLanguage(value)}>
          {languages.map((lang) => (
            <DropdownMenuRadioItem key={lang.code} value={lang.code}>
              {lang.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
