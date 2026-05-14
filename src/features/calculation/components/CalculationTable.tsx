import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ExpandedState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalculationRow } from "@/features/calculation/components/CalculationRow";
import {
  buildCalculationHierarchy,
  type CalculationHierarchyNode,
} from "@/features/calculation/lib/hierarchy";
import { formatCurrency } from "@/features/calculation/lib/formatting";
import type { ProjectItem } from "@/stores/project-store";

type CalculationTableProps = {
  items: ProjectItem[];
  recentlySelectedItemId: string | null;
  onAddItem: () => void;
  onTextChange: (id: string, field: keyof ProjectItem, value: string) => void;
  onNumberChange: (id: string, field: keyof ProjectItem, value: string) => void;
  onTypeChange: (id: string, value: "labor" | "material") => void;
  onOpenMaster: (itemId: string) => void;
  onOpenMaterial: (itemId: string) => void;
  onCreateOrder: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

export function CalculationTable({
  items,
  recentlySelectedItemId,
  onAddItem,
  onTextChange,
  onNumberChange,
  onTypeChange,
  onOpenMaster,
  onOpenMaterial,
  onCreateOrder,
  onDelete,
}: CalculationTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const hierarchy = useMemo(() => buildCalculationHierarchy(items), [items]);

  const table = useReactTable({
    data: hierarchy,
    columns: [{ id: "label", accessorFn: (row) => row.label }],
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex justify-end border-b border-white/10 p-3">
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={onAddItem}>
            <PlusCircle className="size-4" />
            工事項目を追加
          </Button>
        </div>
      </div>

      <div className="mitru-table-scroll overflow-x-auto">
        <table className="w-full min-w-[1200px] table-fixed text-sm">
          <colgroup>
            <col className="w-[29%]" />
            <col className="w-[21%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[3%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-3">工事項目</th>
              <th className="px-3 py-3">材料</th>
              <th className="px-3 py-3">種別</th>
              <th className="px-3 py-3 text-left">数量 / 単位</th>
              <th className="px-3 py-3 text-left">単価</th>
              <th className="px-3 py-3 text-left">法定福利費</th>
              <th className="px-3 py-3 text-left">小計</th>
              <th className="py-3 pl-1 pr-4" />
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => {
              const node = row.original;
              if (node.type !== "item") {
                return (
                  <CalculationGroupRow
                    key={node.id}
                    node={node}
                    expanded={row.getIsExpanded()}
                    onToggle={row.getToggleExpandedHandler()}
                  />
                );
              }

              return (
                <CalculationRow
                  key={node.item.id}
                  item={node.item}
                  index={index}
                  recentlySelected={recentlySelectedItemId === node.item.id}
                  onTextChange={onTextChange}
                  onNumberChange={onNumberChange}
                  onTypeChange={onTypeChange}
                  onOpenMaster={onOpenMaster}
                  onOpenMaterial={onOpenMaterial}
                  onCreateOrder={onCreateOrder}
                  onDelete={onDelete}
                />
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                  工事項目がありません。「工事項目を追加」から始められます。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalculationGroupRow({
  node,
  expanded,
  onToggle,
}: {
  node: Extract<CalculationHierarchyNode, { type: "major" | "middle" }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <tr className={`border-b border-white/10 ${node.type === "major" ? "bg-[#1E3A8A]/35" : "bg-white/[0.045]"}`}>
      <td className="px-4 py-3" colSpan={6}>
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300">
            <Icon className="size-4" />
          </span>
          <span className={node.type === "middle" ? "pl-8" : ""}>
            <span className={node.type === "major" ? "text-base font-bold text-white" : "text-sm font-bold text-slate-200"}>
              {node.type === "major" ? `【${node.label}】` : node.label}
            </span>
            <span className="ml-3 text-xs font-medium text-slate-500">{node.items.length}項目</span>
          </span>
        </button>
      </td>
      <td className="px-3 py-3 text-left text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
        {formatCurrency(node.totals.subtotal)}
      </td>
      <td className="px-3 py-3" />
      <td className="py-3 pl-1 pr-4" />
    </tr>
  );
}
