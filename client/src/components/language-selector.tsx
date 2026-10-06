// Ghost-style menu button like the currency selector beside it: it takes the colour of
// the bar it sits in (white over the home hero). The label comes straight from i18n, so
// it is in prerendered HTML, and SelectMenu holds no state until it is opened (a Radix
// Select, and later a Radix DropdownMenu, re-rendered on every page load).
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from "lucide-react";
import { SelectMenu } from "@/components/select-menu";

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
    <SelectMenu
      value={current.code}
      onSelect={(code) => i18n.changeLanguage(code)}
      ariaLabel="Select language"
      testId="select-language"
      triggerContent={
        <>
          <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>{current.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </>
      }
      groups={[{ items: languages.map((lang) => ({ value: lang.code, content: lang.name })) }]}
    />
  );
}
