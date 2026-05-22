import { useCallback, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, Filter, TrendingUp } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/features/calculation/lib/formatting";
import { formatProfitRate, profitTextClass } from "@/features/calculation/lib/profit";
import {
  buildReportsData,
  createDefaultReportFilters,
  getReportWorkCategories,
  reportsToCsv,
  resolveReportPresetRange,
  type ReportFilters,
  type ReportPeriodPreset,
  type ReportProjectRow,
} from "@/features/reports/lib/reports";
import { ToastMessage } from "@/features/shared/ToastMessage";
import { downloadTextFile } from "@/features/settings/lib/settings-utils";
import { useProjectStore } from "@/stores/project-store";

const periodOptions: Array<{ value: ReportPeriodPreset; label: string }> = [
  { value: "month", label: "今月" },
  { value: "quarter", label: "今四半期" },
  { value: "year", label: "今年" },
  { value: "custom", label: "任意期間" },
];

export function ReportsPage() {
  const {
    projects: allProjects,
    projectItems,
    customers: allCustomers,
    estimateDocuments: allEstimateDocuments,
    invoiceDocuments: allInvoiceDocuments,
  } = useProjectStore(
    useShallow((state) => ({
      projects: state.projects,
      projectItems: state.projectItems,
      customers: state.customers,
      estimateDocuments: state.estimateDocuments,
      invoiceDocuments: state.invoiceDocuments,
    })),
  );
  const [filters, setFilters] = useState<ReportFilters>(() => createDefaultReportFilters());
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);
  const customers = useMemo(() => allCustomers.filter((customer) => !customer.deletedAt), [allCustomers]);
  const estimateDocuments = useMemo(
    () => allEstimateDocuments.filter((document) => !document.deletedAt),
    [allEstimateDocuments],
  );
  const invoiceDocuments = useMemo(
    () => allInvoiceDocuments.filter((document) => !document.deletedAt),
    [allInvoiceDocuments],
  );
  const workCategories = useMemo(() => getReportWorkCategories(projects, projectItems), [projectItems, projects]);
  const report = useMemo(
    () => buildReportsData({ projects, projectItems, customers, estimateDocuments, invoiceDocuments, filters }),
    [customers, estimateDocuments, filters, invoiceDocuments, projectItems, projects],
  );

  const updatePreset = useCallback((preset: ReportPeriodPreset) => {
    const range = resolveReportPresetRange(preset);
    setFilters((current) => ({
      ...current,
      preset,
      ...(range ?? {}),
    }));
  }, []);

  const exportCsv = useCallback(async () => {
    try {
      const saved = await downloadTextFile(
        `mitru_report_${filters.from}_${filters.to}.csv`,
        reportsToCsv(report),
        "text/csv;charset=utf-8",
      );
      if (saved) {
        setToast({ title: "レポートCSVを出力しました", description: "現在のフィルタ条件で集計結果を書き出しました。" });
        window.setTimeout(() => setToast(null), 3200);
      }
    } catch (error) {
      setToast({
        title: "CSV出力に失敗しました",
        description: error instanceof Error ? error.message : "不明なエラー",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3200);
    }
  }, [filters.from, filters.to, report]);

  return (
    <div className="w-full max-w-none">
      <motion.section
        className="px-1 py-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <div className="flex justify-end">
          <Button className="gap-2" onClick={exportCsv}>
            <Download className="size-4" />
            CSV出力
          </Button>
        </div>
      </motion.section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/55 dark:shadow-xl dark:shadow-black/10 dark:backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="size-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">フィルタ</h3>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <Field label="期間">
            <select value={filters.preset} onChange={(event) => updatePreset(event.target.value as ReportPeriodPreset)} className={inputClass}>
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="開始日">
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, preset: "custom", from: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="終了日">
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, preset: "custom", to: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="顧客">
            <select value={filters.customerId} onChange={(event) => setFilters((current) => ({ ...current, customerId: event.target.value }))} className={inputClass}>
              <option value="all" className="bg-slate-950 text-white">すべて</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id} className="bg-slate-950 text-white">
                  {customer.companyName || customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="工事種別">
            <select value={filters.workCategory} onChange={(event) => setFilters((current) => ({ ...current, workCategory: event.target.value }))} className={inputClass}>
              <option value="all" className="bg-slate-950 text-white">すべて</option>
              {workCategories.map((category) => (
                <option key={category} value={category} className="bg-slate-950 text-white">
                  {category}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="売上" value={formatCurrency(report.summary.revenue)} detail={`${report.summary.projectCount}案件`} />
        <SummaryCard label="粗利" value={formatCurrency(report.summary.grossProfit)} detail="期間内の合計" />
        <SummaryCard label="平均粗利率" value={formatProfitRate(report.summary.averageGrossMarginRate)} detail="売上加重平均" />
        <SummaryCard label="法定福利費" value={formatCurrency(report.costBreakdown.welfareCost)} detail="労務費に上乗せ" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Panel title="月次売上・粗利推移" icon={<BarChart3 className="size-4 text-emerald-300" />}>
          <TrendChart data={report.monthlyTrend} />
        </Panel>
        <Panel title="原価内訳" icon={<TrendingUp className="size-4 text-emerald-300" />}>
          <CostBreakdown data={report.costBreakdown} />
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="粗利率分布">
          <div className="grid gap-3">
            {report.grossMarginDistribution.map((bucket) => (
              <DistributionBar key={bucket.label} label={bucket.label} count={bucket.count} total={report.rows.length} color={bucket.color} />
            ))}
          </div>
        </Panel>
        <Panel title="案件別 粗利率">
          <div className="grid gap-3">
            {report.rows.slice(0, 8).map((row) => (
              <ProjectMarginBar key={row.project.id} row={row} />
            ))}
            {report.rows.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-500">対象期間の案件はありません。</p>}
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <RankingPanel title="高利益案件ランキング" rows={report.highProfitProjects} mode="profit" />
        <RankingPanel title="注意案件ランキング" rows={report.watchProjects} mode="margin" />
      </section>

      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function TrendChart({ data }: { data: Array<{ key: string; label: string; revenue: number; grossProfit: number }> }) {
  const max = Math.max(...data.map((item) => Math.max(item.revenue, item.grossProfit)), 1);
  return (
    <div className="grid min-h-[260px] grid-cols-[36px_minmax(0,1fr)] gap-3">
      <div className="flex flex-col justify-between text-right text-[10px] text-slate-500">
        <span>{formatShortCurrency(max)}</span>
        <span>{formatShortCurrency(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="flex items-end gap-3 overflow-x-auto border-l border-b border-white/10 px-3 pb-4">
        {data.map((item) => (
          <div key={item.key ?? item.label} className="flex min-w-12 flex-1 flex-col items-center gap-2">
            <div className="flex h-48 w-full items-end justify-center gap-1">
              <div className="w-4 rounded-t bg-[#1E3A8A]" style={{ height: `${Math.max(4, (item.revenue / max) * 100)}%` }} title={`売上 ${formatCurrency(item.revenue)}`} />
              <div className="w-4 rounded-t bg-emerald-400" style={{ height: `${Math.max(4, (item.grossProfit / max) * 100)}%` }} title={`粗利 ${formatCurrency(item.grossProfit)}`} />
            </div>
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
      <div />
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-[#1E3A8A]" />売上</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-400" />粗利</span>
      </div>
    </div>
  );
}

function CostBreakdown({ data }: { data: { laborCost: number; welfareCost: number; materialCost: number; outsourcingCost: number; totalCost: number } }) {
  const entries = [
    { label: "労務費", value: data.laborCost, className: "bg-sky-400" },
    { label: "法定福利費", value: data.welfareCost, className: "bg-purple-400" },
    { label: "材料費", value: data.materialCost, className: "bg-emerald-400" },
    { label: "外注費", value: data.outsourcingCost, className: "bg-amber-400" },
  ];
  return (
    <div className="grid gap-4">
      <div className="flex h-5 overflow-hidden rounded-full bg-white/[0.08]">
        {entries.map((entry) => (
          <div key={entry.label} className={entry.className} style={{ width: `${data.totalCost > 0 ? (entry.value / data.totalCost) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="grid gap-3">
        {entries.map((entry) => (
          <div key={entry.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 text-slate-400"><span className={`size-2 rounded-full ${entry.className}`} />{entry.label}</span>
            <span className="font-bold text-white">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionBar({ label, count, total, color }: { label: string; count: number; total: number; color: "green" | "yellow" | "red" }) {
  const colorClass = color === "green" ? "bg-emerald-400" : color === "yellow" ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{count}件</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function ProjectMarginBar({ row }: { row: ReportProjectRow }) {
  const width = Math.max(0, Math.min(100, row.grossMarginRate * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-white">{row.project.name}</span>
        <span className={`font-bold tabular-nums ${profitTextClass(row.grossMarginRate)}`}>{formatProfitRate(row.grossMarginRate)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RankingPanel({ title, rows, mode }: { title: string; rows: ReportProjectRow[]; mode: "profit" | "margin" }) {
  return (
    <Panel title={title}>
      <div className="divide-y divide-white/10">
        {rows.map((row) => (
          <div key={row.project.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-medium text-white">{row.project.name}</p>
              <p className="mt-1 text-xs text-slate-500">{row.customerLabel} / {row.workCategory}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-bold text-white">{mode === "profit" ? formatCurrency(row.grossProfit) : formatProfitRate(row.grossMarginRate)}</p>
              <p className="mt-1 text-xs text-slate-500">売上 {formatCurrency(row.revenue)}</p>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">対象データがありません。</p>}
      </div>
    </Panel>
  );
}

function formatShortCurrency(value: number) {
  if (value >= 100000000) return `${Math.round(value / 10000000) / 10}億`;
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`;
  return formatCurrency(value);
}
