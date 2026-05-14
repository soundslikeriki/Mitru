import { formatCurrency, formatDate } from "@/features/calculation/lib/formatting";
import type { Project, ProjectStatus } from "@/stores/project-store";

export function projectStatusClass(status: ProjectStatus, active = false) {
  const base =
    status === "見積中"
      ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-200"
      : status === "契約済"
        ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/[0.12] dark:text-blue-200"
        : status === "施工中"
          ? "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/[0.13] dark:text-orange-200"
          : status === "請求済み"
            ? "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-400/30 dark:bg-purple-400/[0.13] dark:text-purple-200"
            : status === "完了"
              ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-200"
              : "border-slate-300 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200";

  return active
    ? `${base} shadow-sm ring-2 ring-slate-400/20 dark:ring-white/20`
    : base;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${projectStatusClass(status)}`}>
      {status}
    </span>
  );
}

export function ProjectStatusBar({ project }: { project: Project }) {
  return (
    <div className="mt-5 grid gap-3 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-4">
      <InfoPill label="工事場所" value={project.location} />
      <InfoPill label="工事期間" value={`${formatDate(project.startDate)} - ${formatDate(project.endDate)}`} />
      <InfoPill label="工事名" value={project.constructionName} />
      <InfoPill label="合計金額" value={formatCurrency(project.totalAmount)} strong />
    </div>
  );
}

function InfoPill({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none">
      <p className="text-xs text-slate-600 dark:text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? "font-semibold text-slate-900 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}>
        {value}
      </p>
    </div>
  );
}
