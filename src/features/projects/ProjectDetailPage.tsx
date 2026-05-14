import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ProjectHeader } from "@/features/projects/components/ProjectHeader";
import { ProjectTabs } from "@/features/projects/components/ProjectTabs";
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail";
import { ToastMessage } from "@/features/shared/ToastMessage";

export function ProjectDetailPage() {
  const {
    activeTab,
    customers,
    form,
    handleProjectTabChange,
    handleSave,
    linkedCustomer,
    project,
    setToast,
    toast,
    updateField,
  } = useProjectDetail();

  if (!project || !form) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-950/55 p-8 backdrop-blur-xl">
        <p className="mb-3 inline-flex rounded-full border border-amber-300/25 bg-amber-400/[0.12] px-3 py-1 text-xs font-semibold text-amber-200">
          Not Found
        </p>
        <h2 className="text-2xl font-semibold text-white">案件が見つかりません</h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          指定された案件IDのデータがありません。一覧から案件を選び直してください。
        </p>
        <Button asChild className="mt-6">
          <Link to="/projects">案件一覧へ戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none">
      <ProjectHeader project={project} linkedCustomer={linkedCustomer} onNotify={setToast} />
      <ProjectTabs
        activeTab={activeTab}
        customers={customers}
        form={form}
        project={project}
        onSave={handleSave}
        onTabChange={handleProjectTabChange}
        onUpdateField={updateField}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
