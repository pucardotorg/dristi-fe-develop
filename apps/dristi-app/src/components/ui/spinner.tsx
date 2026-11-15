import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const t = useTranslations();
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={t("spinner_loading")} className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
