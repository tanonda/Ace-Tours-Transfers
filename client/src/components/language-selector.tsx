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
      <DropdownMenuTrigger
        className="flex w-auto items-center gap-1.5 h-9 px-3 whitespace-nowrap rounded-md border border-border bg-background text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Select language"
        data-testid="select-language"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span>{current.name}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
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
