import { Input } from "@/components/ui/input";
import { formatCurrency, formatInputNumber, parseNumericInput } from "@/features/calculation/lib/formatting";
import type { InvoiceTotals } from "@/features/calculation/lib/calculation";

type InvoiceProgressProps = {
  invoiceTotals: InvoiceTotals;
  previousInvoiceAmount: number;
  contractBeforeTax: number;
  onUpdateCurrentBillingAmount: (amount: number) => void;
};

export function InvoiceProgress({
  invoiceTotals,
  previousInvoiceAmount,
  contractBeforeTax,
  onUpdateCurrentBillingAmount,
}: InvoiceProgressProps) {
  return (
    <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-2">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4">
        <p className="text-xs font-medium text-emerald-300">前回請求額</p>
        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(previousInvoiceAmount)}</p>
      </div>
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.12] p-4">
        <label className="text-xs font-medium text-emerald-300" htmlFor="current-billing-amount">今回請求額</label>
        <Input
          id="current-billing-amount"
          inputMode="numeric"
          value={formatInputNumber(Math.round(invoiceTotals.beforeTax))}
          onChange={(event) => onUpdateCurrentBillingAmount(parseNumericInput(event.target.value))}
          className="mt-2 h-10 bg-slate-950/45 text-right text-base font-semibold tabular-nums"
          disabled={contractBeforeTax <= 0}
        />
      </div>
    </div>
  );
}
