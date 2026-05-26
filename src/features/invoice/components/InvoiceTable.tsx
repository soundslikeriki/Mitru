import { motion } from "framer-motion";
import { formatCurrency, formatNumber } from "@/features/calculation/lib/formatting";
import {
  formatDocumentSpecification,
  formatDocumentWorkItemLabel,
} from "@/features/documents/document-helpers";
import type { InvoicePdfLine } from "@/features/documents/types";

export function InvoiceTable({ lines }: { lines: InvoicePdfLine[] }) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[1040px] table-auto whitespace-nowrap text-sm">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[18%]" />
          <col className="w-[110px]" />
          <col className="w-[130px]" />
          <col className="w-[160px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
          <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
            <th className="px-4 py-3">工事項目</th>
            <th className="px-4 py-3">品番・仕様</th>
            <th className="px-4 py-3 text-right">数量</th>
            <th className="px-4 py-3 text-right">単価</th>
            <th className="px-4 py-3 text-right">金額（今回請求対象額）</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((invoiceLine, index) => (
            <motion.tr
              key={invoiceLine.item.id}
              className="border-b border-white/10 align-top transition-colors hover:bg-white/[0.04]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.22 }}
            >
              <td className="min-w-[180px] px-4 py-4">
                <p className="font-medium leading-5 text-white" title={formatDocumentWorkItemLabel(invoiceLine.item)}>
                  {formatDocumentWorkItemLabel(invoiceLine.item)}
                </p>
              </td>
              <td className="min-w-[140px] px-4 py-4 text-sm text-slate-300">
                {formatDocumentSpecification(invoiceLine.item) || <span className="text-slate-600">-</span>}
              </td>
              <td className="min-w-[110px] whitespace-nowrap px-4 py-4 text-right tabular-nums text-slate-300">
                {formatNumber(invoiceLine.item.quantity)}{invoiceLine.item.unit}
              </td>
              <td className="min-w-[130px] whitespace-nowrap px-4 py-4 text-right tabular-nums text-slate-300">
                {formatCurrency(invoiceLine.item.quantity > 0 ? invoiceLine.line.subtotal / invoiceLine.item.quantity : invoiceLine.line.subtotal)}
              </td>
              <td className="min-w-[160px] whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-slate-900 dark:text-emerald-300">
                {formatCurrency(invoiceLine.currentAmount)}
              </td>
            </motion.tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                積算項目がありません。積算タブで工事項目を追加すると請求明細に反映されます。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
