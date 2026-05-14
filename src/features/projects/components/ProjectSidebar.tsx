import { formatCurrency, formatDate } from "@/features/calculation/lib/formatting";
import type { Project } from "@/stores/project-store";

export function ProjectSidebar({ project }: { project: Project }) {
  return (
    <aside className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">
      <div className="flex items-center justify-between gap-4">
        <span>契約金額</span>
        <strong className="text-white">{formatCurrency(project.totalAmount)}</strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>開始日</span>
        <span>{formatDate(project.startDate)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>終了日</span>
        <span>{formatDate(project.endDate)}</span>
      </div>
    </aside>
  );
}
