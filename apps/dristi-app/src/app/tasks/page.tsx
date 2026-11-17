import { Suspense } from "react";
import { ListChecksIcon } from "lucide-react";

import { TasksScreen, TasksScreenFallback } from "@/components/tasks/tasks-screen";
import { ProfileScopedEmpty } from "@/components/shell/profile-scoped-empty";
import { useTranslations } from "next-intl";

/** All pending tasks. `useSearchParams` needs a Suspense boundary above it. */
export default function TasksPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<TasksScreenFallback />}>
      <ProfileScopedEmpty
        title={t("tasksPage_nothingToActOn")}
        description={t("tasksPage_filingsPaymentsAndSignaturesThatNeed")}
        icon={<ListChecksIcon aria-hidden />}
      >
        <TasksScreen />
      </ProfileScopedEmpty>
    </Suspense>
  );
}
