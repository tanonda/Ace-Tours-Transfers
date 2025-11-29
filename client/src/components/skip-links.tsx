import { useTranslation } from "react-i18next";

export function SkipLinks() {
  const { t } = useTranslation();
  
  return (
    <div className="skip-links">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
        data-testid="skip-to-main"
      >
        {t("accessibility.skipToMain")}
      </a>
      <a
        href="#main-navigation"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-48 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
        data-testid="skip-to-nav"
      >
        {t("accessibility.skipToNav")}
      </a>
    </div>
  );
}
