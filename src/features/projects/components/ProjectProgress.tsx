import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, FileText, PackageCheck, ReceiptText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/features/calculation/lib/formatting";
import { formatProfitRate } from "@/features/calculation/lib/profit";
import { DocumentStatusBadge } from "@/features/documents";
import { ContextHelp } from "@/features/help/ContextHelp";
import { ProjectProfitManagement } from "@/features/projects/components/ProjectProfitManagement";
import {
  getInvoiceOutstandingAmount,
  getInvoicePaidAmount,
  getInvoiceTotalAmount,
} from "@/features/payments/lib/payments";
import {
  buildProjectProfitMetrics,
  projectProfitTextClass,
  projectProfitToneClass,
} from "@/features/projects/lib/profit-dashboard";
import { getProjectUserLabel } from "@/features/projects/lib/project-utils";
import { projectStatusClass } from "@/features/projects/components/ProjectStatusBar";
import type { Project, ProjectStatus } from "@/stores/project-store";
import { useProjectStore } from "@/stores/project-store";

const workflowStatuses: ProjectStatus[] = ["見積中", "契約済", "施工中", "完了", "請求済み", "請求締済", "失注", "破棄"];
const memoMaxLength = 500;

export function ProjectProgress({ project }: { project: Project }) {
  const updateProject = useProjectStore((state) => state.updateProject);
  const allProjects = useProjectStore((state) => state.projects);
  const projectItems = useProjectStore((state) => state.projectItems);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const deliveryDocuments = useProjectStore((state) => state.deliveryDocuments);
  const orderDocuments = useProjectStore((state) => state.orderDocuments);
  const cloudUser = useProjectStore((state) => state.cloudSyncSettings.user);
  const [nextActionDate, setNextActionDate] = useState(project.nextActionDate ?? "");
  const [processMemo, setProcessMemo] = useState(project.processMemo ?? "");
  const [ownerMemo, setOwnerMemo] = useState(project.ownerMemo ?? "");

  const projects = useMemo(() => allProjects.filter((item) => !item.deletedAt), [allProjects]);
  const metric = useMemo(
    () => buildProjectProfitMetrics(projects, projectItems).find((item) => item.project.id === project.id),
    [project.id, projectItems, projects],
  );
  const projectEstimates = useMemo(
    () => estimateDocuments.filter((document) => !document.deletedAt && document.projectId === project.id),
    [estimateDocuments, project.id],
  );
  const projectInvoices = useMemo(
    () => invoiceDocuments.filter((document) => !document.deletedAt && document.projectId === project.id),
    [invoiceDocuments, project.id],
  );
  const paymentTotal = projectInvoices.reduce((sum, document) => sum + getInvoiceTotalAmount(document), 0);
  const paidTotal = projectInvoices.reduce((sum, document) => sum + getInvoicePaidAmount(document), 0);
  const outstandingTotal = projectInvoices.reduce((sum, document) => sum + getInvoiceOutstandingAmount(document), 0);
  const paymentProgressRate = paymentTotal > 0 ? Math.min(100, (paidTotal / paymentTotal) * 100) : 0;
  const projectDeliveries = deliveryDocuments.filter((document) => document.projectId === project.id);
  const projectOrders = orderDocuments.filter((document) => document.projectId === project.id);
  const progressWarningTone = getProgressWarningTone(metric?.actualGrossMarginRate ?? 1);

  const saveProgressMemo = () => {
    updateProject(project.id, {
      nextActionDate,
      processMemo: processMemo.slice(0, memoMaxLength),
      ownerMemo: ownerMemo.slice(0, memoMaxLength),
    });
  };
  const confirmStatusChange = (status: ProjectStatus) => {
    if (status === project.status) return;
    updateProject(project.id, { status });
  };

  return (
    <motion.section
      className="grid gap-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="mb-1 font-mono text-sm font-bold tabular-nums text-emerald-300">
              案件No. {project.projectNumber || "未採番"}
            </p>
            <h3 className="text-lg font-semibold text-white">進行管理</h3>
            <p className="mt-1 text-sm text-slate-400">案件の現在位置、次の対応、書類と利益状況をまとめて確認します。</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                作成者: {getProjectUserLabel(project.ownerId, cloudUser)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                担当: {getProjectUserLabel(project.assignedTo, cloudUser)}
              </span>
            </div>
          </div>
          <div className="inline-flex flex-wrap items-center gap-2">
            <ContextHelp
              title="進行管理の使い方"
              description="案件の状態、次回対応、書類発行状況、利益リスクを一画面で確認するためのタブです。"
              items={[
                "ステータスは見積中、契約済、施工中、完了、請求済み、請求締済、失注、破棄から選べます。",
                "次回対応日を入れておくと、ダッシュボードに近い案件として表示されます。",
                "書類進捗で見積・請求・納品・注文の発行状況をまとめて確認できます。",
                "粗利率が30%未満で黄色、25%未満で赤色の警告が出ます。",
              ]}
            />
            {workflowStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => confirmStatusChange(status)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${projectStatusClass(status, project.status === status)}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              次回対応日
              <Input
                type="date"
                value={nextActionDate}
                onBlur={saveProgressMemo}
                onChange={(event) => setNextActionDate(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              <span className="flex items-center justify-between gap-3">
                <span>工程メモ</span>
                <span className="text-xs font-medium text-slate-500">{processMemo.length}/{memoMaxLength}</span>
              </span>
              <textarea
                value={processMemo}
                maxLength={memoMaxLength}
                onBlur={saveProgressMemo}
                onChange={(event) => setProcessMemo(event.target.value)}
                className="min-h-24 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                placeholder="例: 今週は内装下地、来週から仕上げ工程"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              <span className="flex items-center justify-between gap-3">
                <span>担当者メモ</span>
                <span className="text-xs font-medium text-slate-500">{ownerMemo.length}/{memoMaxLength}</span>
              </span>
              <textarea
                value={ownerMemo}
                maxLength={memoMaxLength}
                onBlur={saveProgressMemo}
                onChange={(event) => setOwnerMemo(event.target.value)}
                className="min-h-24 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                placeholder="例: 施主確認、外注回答待ち、現場注意点など"
              />
            </label>
            <div className="flex justify-end">
              <Button type="button" onClick={saveProgressMemo}>進行メモを保存</Button>
            </div>
          </div>

          <div className="grid content-start gap-3">
            {progressWarningTone && (
              <div className={`rounded-xl border p-4 ${progressWarningToneClass(progressWarningTone)}`}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className={`size-4 ${progressWarningIconClass(progressWarningTone)}`} />
                  {progressWarningTone === "red"
                    ? "粗利率が25%を下回る可能性があります"
                    : "粗利率が30%を下回る可能性があります"}
                </p>
                <p className="mt-2 text-xs font-medium leading-6 opacity-90">実行原価を確認し、材料・労務・外注費の増加を早めに見直してください。</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <ProjectProfitManagement projectId={project.id} />

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h4 className="text-base font-semibold text-white">書類進捗状況</h4>
          <div className="mt-4 grid gap-3">
            <DocumentProgressRow icon={FileText} label="見積書" count={projectEstimates.length} statuses={projectEstimates.map((document) => document.status)} />
            <DocumentProgressRow icon={ReceiptText} label="請求書" count={projectInvoices.length} statuses={projectInvoices.map((document) => document.status)} />
            <DocumentProgressRow icon={PackageCheck} label="納品書" count={projectDeliveries.length} statuses={[]} hideStatuses />
            <DocumentProgressRow icon={ShoppingCart} label="注文書" count={projectOrders.length} statuses={[]} hideStatuses />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h4 className="text-base font-semibold text-white">利益・キャッシュフロー概要</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ProfitCard label="予定粗利" value={formatCurrency(metric?.estimatedGrossProfit ?? 0)} />
            <ProfitCard label="実行粗利" value={formatCurrency(metric?.actualGrossProfit ?? 0)} />
            <ProfitCard
              label="実行粗利率"
              value={formatProfitRate(metric?.actualGrossMarginRate ?? 0)}
              className={projectProfitTextClass(metric?.riskLevel ?? "watch")}
            />
            <ProfitCard label="入金予定日" value={project.expectedPaymentDate ? project.expectedPaymentDate.replaceAll("-", "/") : "未設定"} />
            <ProfitCard label="請求額" value={formatCurrency(paymentTotal)} />
            <ProfitCard label="入金済" value={formatCurrency(paidTotal)} className="text-emerald-300" />
            <ProfitCard label="未入金" value={formatCurrency(outstandingTotal)} className={outstandingTotal > 0 ? "text-amber-300" : "text-emerald-300"} />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">請求 → 入金進捗</p>
              <p className="text-xs font-bold tabular-nums text-emerald-300">{paymentProgressRate.toFixed(0)}%</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${paymentProgressRate}%` }} />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
              <span>請求額 {formatCurrency(paymentTotal)}</span>
              <span>入金済 {formatCurrency(paidTotal)}</span>
              <span>残債 {formatCurrency(outstandingTotal)}</span>
            </div>
          </div>
          <div className={`mt-4 rounded-xl border p-4 ${projectProfitToneClass(metric?.riskLevel ?? "watch")}`}>
            <p className="text-sm font-semibold">利益判定: {metric?.riskLabel ?? "未計算"}</p>
            <p className="mt-2 text-xs leading-6 opacity-80">予定粗利と実行粗利の差額: {formatCurrency(metric?.profit.profitDiff ?? 0)}</p>
          </div>
        </div>
      </section>
    </motion.section>
  );
}

function getProgressWarningTone(rate: number): "amber" | "red" | null {
  if (rate < 0.25) return "red";
  if (rate < 0.3) return "amber";
  return null;
}

function progressWarningToneClass(tone: "amber" | "red") {
  if (tone === "red") {
    return "border-red-300 bg-red-100 text-red-800 dark:border-red-400/25 dark:bg-red-400/[0.12] dark:text-red-200";
  }
  return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-200";
}

function progressWarningIconClass(tone: "amber" | "red") {
  if (tone === "red") return "text-red-700 dark:text-red-300";
  return "text-amber-700 dark:text-amber-300";
}

function DocumentProgressRow({
  icon: Icon,
  label,
  count,
  statuses,
  hideStatuses = false,
}: {
  icon: typeof FileText;
  label: string;
  count: number;
  statuses: string[];
  hideStatuses?: boolean;
}) {
  const statusCounts = statuses.reduce<Record<string, number>>((counts, status) => {
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const statusEntries = Object.entries(statusCounts);

  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-[#1E3A8A]/45 text-emerald-300">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-500">{count}件</p>
        </div>
      </div>
      {!hideStatuses ? (
        <div className="flex flex-wrap gap-1.5">
          {statusEntries.length > 0 ? (
            statusEntries.map(([status, count]) => (
              <span key={status} className="inline-flex items-center gap-1">
                <DocumentStatusBadge status={status} />
                {count > 1 ? <span className="text-xs font-semibold text-slate-500">x{count}</span> : null}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-500">未作成</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProfitCard({ label, value, className = "text-white" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}
