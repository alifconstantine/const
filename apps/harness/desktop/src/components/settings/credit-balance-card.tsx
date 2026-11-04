import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useTranslation } from "../../lib/i18n";
import { ArrowUpRight } from "lucide-react";

export function CreditBalanceCard() {
  const wallet = useQuery(api.router.credits.getUserCredits, {});
  const { t, language } = useTranslation();
  return (
    <section
      className="space-y-3 rounded-2xl bg-neutral-50 p-4 dark:bg-[#222222]"
      aria-label={t("settings.creditBalance")}
    >
      <h3 className="text-sm font-medium">{t("settings.creditBalance")}</h3>
      <p className="break-words text-2xl font-medium tabular-nums">
        {wallet
          ? new Intl.NumberFormat(language, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 6,
            }).format(wallet.availableUsd)
          : t("common.loading")}
      </p>
      <p className="text-xs leading-6 text-muted-foreground">
        {t("settings.creditBalanceNote")}
      </p>
      <a
        href="https://router.const.web.id/credits"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (window.electron?.openExternal) {
            event.preventDefault();
            void window.electron.openExternal(
              "https://router.const.web.id/credits",
            );
          }
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted focus-visible:outline focus-visible:outline-1"
      >
        {t("settings.addCredit")}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </section>
  );
}
