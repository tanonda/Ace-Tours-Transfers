import { useTranslation } from "react-i18next";
import { invalidPersonName } from "@shared/person-name";
import { cn } from "@/lib/utils";

/**
 * Message under a person-name field, shown while the visitor types, for the same
 * rule the server enforces (shared/person-name.ts): no < or >. Point the input's
 * aria-describedby at `id`, and block submit with invalidPersonName(value).
 */
export function NameError({ value, id, className }: { value: unknown; id: string; className?: string }) {
  const { t } = useTranslation();
  if (!invalidPersonName(value)) return null;
  return (
    <p id={id} role="alert" className={cn("text-sm font-medium text-destructive", className)}>
      {t("common.nameNoAngleBrackets", "Names can't contain < or >.")}
    </p>
  );
}
