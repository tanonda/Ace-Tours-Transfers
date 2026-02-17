// Fix #24: Replaced native <select> with Shadcn Select component for visual consistency
// with the rest of the UI, especially in dark mode and custom-themed deployments.
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'bi', name: 'Bislama' },
  { code: 'zh', name: '中文' },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <Select
      value={i18n.language}
      onValueChange={(value) => i18n.changeLanguage(value)}
    >
      <SelectTrigger
        className="w-auto gap-1.5 h-9 px-3 text-sm border-border bg-background"
        aria-label="Select language"
        data-testid="select-language"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map(lang => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
