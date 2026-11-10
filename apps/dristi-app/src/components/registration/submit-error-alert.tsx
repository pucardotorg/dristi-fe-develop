import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/** The registration steps' answer to a failed submit, above the actions. */
export function SubmitErrorAlert({ message }: { message: string }) {
  const __t = __useTranslations();
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertDescription>{__t(message)}</AlertDescription>
    </Alert>
  );
}
