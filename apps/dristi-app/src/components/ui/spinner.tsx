import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const __t = __useTranslations();
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={__t("spinner_loading")} className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
