import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/features/calculation/lib/formatting";
import { ToastMessage } from "@/features/shared/ToastMessage";
import type { EstimateDocument, Project } from "@/stores/project-store";
import { useProjectStore } from "@/stores/project-store";

type CloseCandidate = {
  estimate: EstimateDocument;
  project: Project | undefined;
  clientName: string;
  customerKey: string;
  amount: number;
};

export function BillingClosePage() {
  const projects = useProjectStore((state) => state.projects);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const billingCloseRecords = useProjectStore((state) => state.billingCloseRecords);
  const createBillingCloseRun = useProjectStore((state) => state.createBillingCloseRun);
  const [closingDate, setClosingDate] = useState(getDefaultClosingDate());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const candidates = useMemo(
    () => buildCloseCandidates({ estimates: estimateDocuments, invoices: invoiceDocuments, projects, closingDate }),
    [closingDate, estimateDocuments, invoiceDocuments, projects],
  );
  const selectedCandidates = candidates.filter((candidate) => selectedIds.includes(candidate.estimate.id));
  const groupedCandidates = groupCandidatesByCustomer(candidates);
  const selectedTotal = selectedCandidates.reduce((sum, candidate) => sum + candidate.amount, 0);

  const toggleCandidate = (estimateId: string) => {
    setSelectedIds((current) =>
      current.includes(estimateId)
        ? current.filter((id) => id !== estimateId)
        : [...current, estimateId],
    );
  };

  const toggleGroup = (groupIds: string[]) => {
    const allSelected = groupIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !groupIds.includes(id));
      return Array.from(new Set([...current, ...groupIds]));
    });
  };

  const createInvoices = () => {
    if (selectedIds.length === 0) {
      setToast({ title: "対象を選択してください", description: "締め処理に含める未請求見積書を選択してください。", tone: "error" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    const records = createBillingCloseRun({ closingDate, estimateIds: selectedIds });
    setSelectedIds([]);
    setToast({
      title: "請求締めを作成しました",
      description: `${records.length}件の取引先グループで請求書を作成しました。`,
    });
    window.setTimeout(() => setToast(null), 3600);
  };

  return (
    <div className="w-full max-w-none">
      <section className="grid gap-3">
        <div className="flex justify-end">
          <Button className="gap-2" onClick={createInvoices}>
            <FileText className="size-4" />
            一括請求書作成
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-[260px_1fr] md:items-start">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            締め日
            <Input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
          </label>
          <div className="rounded-xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-medium text-slate-500">選択中</p>
            <p className="mt-1 text-xl font-bold text-white">
              {selectedIds.length}件 / {formatCurrency(selectedTotal)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/10 p-4">
          <CalendarDays className="size-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">未請求の見積書</h3>
        </div>
        <div className="divide-y divide-white/10">
          {groupedCandidates.map((group) => {
            const groupIds = group.items.map((item) => item.estimate.id);
            const allSelected = groupIds.every((id) => selectedIds.includes(id));
            return (
              <div key={group.customerKey} className="p-4">
                <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupIds)}
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      allSelected
                        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-400/30"
                    }`}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {allSelected ? "選択済み" : "取引先ごと選択"}
                  </button>
                  <div className="md:text-right">
                    <p className="text-sm font-semibold text-white">{group.clientName}</p>
                    <p className="mt-1 text-xs text-slate-500">{group.items.length}件 / {formatCurrency(group.totalAmount)}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {group.items.map(({ estimate, project, amount }) => (
                    <label
                      key={estimate.id}
                      className="grid cursor-pointer gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:bg-white/[0.06] md:grid-cols-[auto_1fr_120px_130px] md:items-center"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(estimate.id)}
                        onChange={() => toggleCandidate(estimate.id)}
                        className="size-4 accent-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{project?.name ?? "不明な案件"}</p>
                        <p className="mt-1 text-xs text-slate-500">{estimate.documentNumber}</p>
                      </div>
                      <p className="text-xs text-slate-400">{formatDate(estimate.issuedAt)}</p>
                      <p className="font-bold tabular-nums text-white md:text-right">{formatCurrency(amount)}</p>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {groupedCandidates.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">指定した締め日までの未請求見積書はありません。</p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-white">締め処理履歴</h3>
        <div className="mt-4 grid gap-3">
          {billingCloseRecords.map((record) => (
            <motion.div
              key={record.id}
              className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[1fr_130px_130px_120px] md:items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div>
                <p className="font-semibold text-white">{record.clientName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  対象案件 {record.targetEstimateIds.length}件 / 作成請求書 {record.createdInvoiceIds.length}件
                </p>
              </div>
              <p className="text-sm text-slate-300">{formatDate(record.closingDate)}</p>
              <p className="font-bold tabular-nums text-white md:text-right">{formatCurrency(record.totalAmount)}</p>
              <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {record.status}
              </span>
            </motion.div>
          ))}
          {billingCloseRecords.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-500">締め処理履歴はまだありません。</p>
          )}
        </div>
      </section>

      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function buildCloseCandidates({
  estimates,
  invoices,
  projects,
  closingDate,
}: {
  estimates: EstimateDocument[];
  invoices: Array<{ sourceEstimateDocumentId?: string }>;
  projects: Project[];
  closingDate: string;
}): CloseCandidate[] {
  const invoicedEstimateIds = new Set(invoices.map((invoice) => invoice.sourceEstimateDocumentId).filter(Boolean));
  return estimates
    .filter((estimate) => estimate.status === "発行済")
    .filter((estimate) => !invoicedEstimateIds.has(estimate.id))
    .filter((estimate) => !closingDate || estimate.issuedAt <= closingDate)
    .map((estimate) => {
      const project = projects.find((item) => item.id === estimate.projectId);
      const clientName = project?.clientCompanyName || project?.clientName || "未設定の取引先";
      return {
        estimate,
        project,
        clientName,
        customerKey: project?.customerId || clientName,
        amount: estimate.totalsSnapshot?.afterTax ?? estimate.totalAmount,
      };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.estimate.issuedAt.localeCompare(b.estimate.issuedAt));
}

function groupCandidatesByCustomer(candidates: CloseCandidate[]) {
  const groups = new Map<string, { customerKey: string; clientName: string; totalAmount: number; items: CloseCandidate[] }>();
  candidates.forEach((candidate) => {
    const current = groups.get(candidate.customerKey) ?? {
      customerKey: candidate.customerKey,
      clientName: candidate.clientName,
      totalAmount: 0,
      items: [],
    };
    current.totalAmount += candidate.amount;
    current.items.push(candidate);
    groups.set(candidate.customerKey, current);
  });
  return Array.from(groups.values());
}

function getDefaultClosingDate() {
  const today = new Date();
  const closing = new Date(today.getFullYear(), today.getMonth(), 25);
  return closing.toISOString().slice(0, 10);
}
