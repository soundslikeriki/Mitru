import { Input } from "@/components/ui/input";
import { formatCurrency, formatInputNumber, parseNumericInput } from "@/features/calculation/lib/formatting";
import type { InvoiceTotals } from "@/features/calculation/lib/calculation";

type InvoiceProgressProps = {
  invoiceTotals: InvoiceTotals;
  previousInvoiceAmount: number;
  paidAmount: number;
  carryOverAmount: number;
  contractBeforeTax: number;
  onUpdateCurrentBillingAmount: (amount: number) => void;
};

export function InvoiceProgress({
  invoiceTotals,
  previousInvoiceAmount,
  paidAmount,
  carryOverAmount,
  contractBeforeTax,
  onUpdateCurrentBillingAmount,
}: InvoiceProgressProps) {
  return (
    <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-300/50 dark:bg-blue-100">
        <p className="text-xs font-semibold text-blue-950">前回請求額</p>
        <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(previousInvoiceAmount)}</p>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm dark:border-sky-300/50 dark:bg-sky-100">
        <p className="text-xs font-semibold text-blue-950">御入金額</p>
        <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(paidAmount)}</p>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-300/50 dark:bg-blue-100">
        <p className="text-xs font-semibold text-blue-950">繰越残高</p>
        <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(carryOverAmount)}</p>
      </div>
      <div className="rounded-xl border border-sky-300 bg-sky-100 p-4 shadow-sm dark:border-sky-300/60 dark:bg-sky-100">
        <label className="text-xs font-semibold text-blue-950" htmlFor="current-billing-amount">今回請求額</label>
        <Input
          id="current-billing-amount"
          inputMode="numeric"
          value={formatInputNumber(Math.round(invoiceTotals.beforeTax))}
          onChange={(event) => onUpdateCurrentBillingAmount(parseNumericInput(event.target.value))}
          className="mt-2 h-10 border-blue-200 bg-white text-right text-base font-bold tabular-nums text-slate-900 focus:border-blue-500 dark:border-blue-300/70 dark:bg-white dark:text-slate-900"
          disabled={contractBeforeTax <= 0}
        />
      </div>
    </div>
  );
}
