import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/features/calculation/lib/formatting";
import {
  buildPaymentInvoiceSummaries,
  flattenPaymentRecords,
  getMonthPaymentTotal,
  type PaymentCollectionStatus,
  summarizePaymentsByMethod,
} from "@/features/payments/lib/payments";
import { useProjectStore } from "@/stores/project-store";

export function PaymentsPage() {
  const allProjects = useProjectStore((state) => state.projects);
  const allInvoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const [statusFilter, setStatusFilter] = useState<PaymentCollectionStatus | "すべて">("すべて");
  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);
  const invoiceDocuments = useMemo(
    () => allInvoiceDocuments.filter((document) => !document.deletedAt),
    [allInvoiceDocuments],
  );
  const summaries = useMemo(
    () => buildPaymentInvoiceSummaries({ invoices: invoiceDocuments, projects }),
    [invoiceDocuments, projects],
  );
  const paymentRecords = useMemo(
    () => flattenPaymentRecords({ invoices: invoiceDocuments, projects }),
    [invoiceDocuments, projects],
  );
  const filteredSummaries = summaries.filter(({ invoice, project, collectionStatus }) => {
    const matchesStatus = statusFilter === "すべて" || collectionStatus === statusFilter;
    return matchesStatus;
  });
  const unpaidSummaries = filteredSummaries.filter((summary) => summary.outstandingAmount > 0);
  const totalOutstanding = unpaidSummaries.reduce((sum, summary) => sum + summary.outstandingAmount, 0);
  const totalPaid = summaries.reduce((sum, summary) => sum + summary.paidAmount, 0);
  const methodSummary = summarizePaymentsByMethod(paymentRecords);
  const thisMonthPaid = getMonthPaymentTotal(paymentRecords);

  return (
    <div className="w-full max-w-none">
      <section className="grid gap-4 md:grid-cols-3">
        <PaymentSummaryCard label="未入金請求書" value={`${unpaidSummaries.length}件`} detail={formatCurrency(totalOutstanding)} />
        <PaymentSummaryCard label="入金済合計" value={formatCurrency(totalPaid)} detail="登録済み入金履歴の合計" />
        <PaymentSummaryCard label="今月の入金実績" value={formatCurrency(thisMonthPaid)} detail={`${paymentRecords.length}件の履歴から集計`} />
      </section>

      <section className="mt-5 grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PaymentCollectionStatus | "すべて")}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
          >
            {["すべて", "未入金", "一部入金", "入金済", "過入金"].map((option) => (
              <option key={option} value={option} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1200px] table-auto whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
                <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">請求番号</th>
                  <th className="px-4 py-3">案件名</th>
                  <th className="px-4 py-3 text-right">請求額</th>
                  <th className="px-4 py-3 text-right">入金済</th>
                  <th className="px-4 py-3 text-right">残債</th>
                  <th className="px-4 py-3">状態</th>
                  <th className="px-4 py-3">支払期限</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
              {filteredSummaries.map(({ invoice, project, invoiceTotal, paidAmount, outstandingAmount, overpaidAmount, collectionStatus }, index) => (
                <motion.tr
                  key={invoice.id}
                  className="border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.015, duration: 0.2 }}
                >
                  <td className="px-4 py-4 font-medium text-white">{invoice.documentNumber}</td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{project?.name ?? "不明な案件"}</p>
                    <p className="mt-1 text-xs text-slate-500">{project?.clientCompanyName || project?.clientName || "-"}</p>
                  </td>
                  <td className="px-4 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(invoiceTotal)}</td>
                  <td className="px-4 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(paidAmount)}</td>
                  <td className={`px-4 py-4 text-right font-bold tabular-nums ${outstandingAmount > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {formatCurrency(outstandingAmount)}
                    {overpaidAmount > 0 && <p className="mt-1 text-xs text-red-600 dark:text-red-300">過入金 {formatCurrency(overpaidAmount)}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <PaymentStatusBadge status={collectionStatus} />
                  </td>
                  <td className="px-4 py-4 text-slate-300">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-4 text-right">
                    <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                      <Link to={`/projects/${invoice.projectId}/invoices`}>入金登録</Link>
                    </Button>
                  </td>
                </motion.tr>
              ))}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={8} className="h-32 text-center text-slate-500">
                    条件に一致する請求書がありません。
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-white">入金方法別集計</h3>
          <div className="mt-4 grid gap-3">
            {Object.entries(methodSummary).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="text-sm text-slate-300">{method}</span>
                <span className="font-bold tabular-nums text-white">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-white">入金履歴</h3>
          <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
            {paymentRecords.map(({ record, invoice, project }) => (
              <div key={record.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="font-semibold text-white">{formatCurrency(record.amount)}</p>
                    <p className="mt-1 text-xs text-slate-500">{invoice.documentNumber} / {project?.name ?? "不明な案件"}</p>
                  </div>
                  <div className="text-left text-xs text-slate-400 sm:text-right">
                    <p>{formatDate(record.paymentDate)}</p>
                    <p className="mt-1">{record.paymentMethod}</p>
                  </div>
                </div>
                {record.note && <p className="mt-3 text-xs text-slate-500">{record.note}</p>}
              </div>
            ))}
            {paymentRecords.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-500">入金履歴はまだありません。</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function PaymentSummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentCollectionStatus }) {
  const className =
    status === "入金済"
      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/[0.12] dark:text-emerald-200"
      : status === "一部入金"
        ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/[0.12] dark:text-blue-200"
        : status === "過入金"
          ? "border-red-300 bg-red-100 text-red-800 dark:border-red-400/25 dark:bg-red-400/[0.12] dark:text-red-200"
          : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/[0.12] dark:text-amber-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}
