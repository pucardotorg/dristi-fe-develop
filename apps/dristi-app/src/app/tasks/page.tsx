import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import { Suspense } from "react";
import { ListChecksIcon } from "lucide-react";

import { TasksScreen, TasksScreenFallback } from "@/components/tasks/tasks-screen";
import { ProfileScopedEmpty } from "@/components/shell/profile-scoped-empty";

/** All pending tasks. `useSearchParams` needs a Suspense boundary above it. */
export default function TasksPage() {
  const __t = __useTranslations();
  return (
    <Suspense fallback={<TasksScreenFallback />}>
      <ProfileScopedEmpty
        title={__t("tasksPage_nothingToActOn")}
        description={__t("tasksPage_filingsPaymentsAndSignaturesThatNeedYour")}
        icon={<ListChecksIcon aria-hidden />}
      >
        <TasksScreen />
      </ProfileScopedEmpty>
    </Suspense>
  );
}
