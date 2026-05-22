import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatInputNumber, parseNumericInput } from "@/features/calculation/lib/formatting";
import { buildPurchaseOrderSummaries } from "@/features/purchases/lib/purchases";
import { ToastMessage } from "@/features/shared/ToastMessage";
import type { OrderDocument, PaymentMethod } from "@/stores/project-store";
import { useProjectStore } from "@/stores/project-store";

const paymentMethodOptions: PaymentMethod[] = ["銀行振込", "現金", "カード", "その他"];

export function PurchasesPage() {
  const allProjects = useProjectStore((state) => state.projects);
  const orderDocuments = useProjectStore((state) => state.orderDocuments);
  const materialMasters = useProjectStore((state) => state.materialMasters);
  const registerOrderPurchase = useProjectStore((state) => state.registerOrderPurchase);
  const [targetOrder, setTargetOrder] = useState<OrderDocument | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("銀行振込");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);
  const summaries = useMemo(
    () => buildPurchaseOrderSummaries({ orders: orderDocuments, projects, materialMasters }),
    [materialMasters, orderDocuments, projects],
  );
  const filteredSummaries = summaries;
  const openOrders = summaries.filter((summary) => summary.remainingAmount > 0);
  const totalRemaining = openOrders.reduce((sum, summary) => sum + summary.remainingAmount, 0);
  const totalPurchased = summaries.reduce((sum, summary) => sum + summary.purchasedAmount, 0);

  const openPurchaseForm = (order: OrderDocument) => {
    setTargetOrder(order);
    setPurchaseAmount(formatInputNumber(Math.max(0, order.totalAmount - (order.purchasedAmount ?? 0))));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("銀行振込");
    setNote("");
  };

  const registerPurchase = () => {
    if (!targetOrder) return;
    const amount = parseNumericInput(purchaseAmount);
    if (amount <= 0) {
      setToast({ title: "仕入額を入力してください", description: "0円より大きい金額を入力してください。", tone: "error" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    const record = registerOrderPurchase(targetOrder.id, {
      amount,
      paymentDate,
      paymentMethod,
      note,
    });
    if (!record) {
      setToast({ title: "仕入登録に失敗しました", description: "対象の発注書が見つかりません。", tone: "error" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    setTargetOrder(null);
    setPurchaseAmount("");
    setToast({ title: "仕入を登録しました", description: `${targetOrder.documentNumber} に ${formatCurrency(record.amount)} を反映しました。` });
    window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="w-full max-w-none">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="発注残" value={`${openOrders.length}件`} detail={formatCurrency(totalRemaining)} />
        <SummaryCard label="仕入済合計" value={formatCurrency(totalPurchased)} detail="登録済み仕入の合計" />
        <SummaryCard label="発注書" value={`${summaries.length}件`} detail="注文書から連携" />
      </section>

      {targetOrder && (
        <section className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4">
          <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-start">
            <div>
              <h3 className="text-sm font-semibold text-white">仕入登録</h3>
              <p className="mt-1 text-xs text-slate-400">{targetOrder.documentNumber} / {targetOrder.supplierName}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTargetOrder(null)}>閉じる</Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[160px_160px_160px_minmax(0,1fr)_auto] lg:items-end">
            <Field label="支払額">
              <Input value={purchaseAmount} onChange={(event) => setPurchaseAmount(formatInputNumber(event.target.value))} />
            </Field>
            <Field label="支払日">
              <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </Field>
            <Field label="方法">
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
              >
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method} className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
                    {method}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="メモ">
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="任意" />
            </Field>
            <Button onClick={registerPurchase}>仕入登録</Button>
          </div>
        </section>
      )}

      <section className="mt-5 grid gap-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-auto text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">注文番号</th>
                <th className="px-4 py-3">案件名</th>
                <th className="px-4 py-3">発注先</th>
                <th className="px-4 py-3 text-right">発注額</th>
                <th className="px-4 py-3 text-right">仕入済</th>
                <th className="px-4 py-3 text-right">発注残</th>
                <th className="px-4 py-3">納期</th>
                <th className="px-4 py-3">価格差</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map(({ order, project, orderedAmount, purchasedAmount, remainingAmount, unitPriceDiff }, index) => (
                <motion.tr
                  key={order.id}
                  className="border-b border-white/10 transition-colors hover:bg-white/[0.04]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.015, duration: 0.2 }}
                >
                  <td className="px-4 py-4 font-medium text-white">{order.documentNumber}</td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{project?.name ?? "不明な案件"}</p>
                    <p className="mt-1 text-xs text-slate-500">{order.title}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{order.supplierName || "未設定"}</td>
                  <td className="px-4 py-4 text-right font-bold tabular-nums text-white">{formatCurrency(orderedAmount)}</td>
                  <td className="px-4 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(purchasedAmount)}</td>
                  <td className={`px-4 py-4 text-right font-bold tabular-nums ${remainingAmount > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {formatCurrency(remainingAmount)}
                  </td>
                  <td className="px-4 py-4 text-slate-300">{formatDate(order.dueDate)}</td>
                  <td className="px-4 py-4">
                    {unitPriceDiff == null ? (
                      <span className="text-xs text-slate-500">比較なし</span>
                    ) : (
                      <span className={`text-xs font-bold ${unitPriceDiff > 0 ? "text-red-400" : unitPriceDiff < 0 ? "text-emerald-300" : "text-slate-400"}`}>
                        {unitPriceDiff > 0 ? "+" : ""}{formatCurrency(unitPriceDiff)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openPurchaseForm(order)}>
                        仕入登録
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                        <Link to={`/projects/${order.projectId}`}>案件を開く</Link>
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={9} className="h-32 text-center text-slate-500">
                    条件に一致する発注書がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </section>

      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
