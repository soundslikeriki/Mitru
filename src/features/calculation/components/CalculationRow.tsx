import { type HTMLAttributes, type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Package, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateLine } from "@/features/calculation/lib/calculation";
import {
  commonUnits,
  confirmDestructive,
  formatCurrency,
  formatInputNumber,
  laborUnits,
  parseNumericInput,
} from "@/features/calculation/lib/formatting";
import {
  getEstimatedLaborUnitCost,
  getEstimatedUnitCost,
} from "@/features/calculation/lib/profit";
import type { ProjectItem } from "@/stores/project-store";

type CalculationRowProps = {
  item: ProjectItem;
  index: number;
  recentlySelected: boolean;
  onTextChange: (id: string, field: keyof ProjectItem, value: string) => void;
  onNumberChange: (id: string, field: keyof ProjectItem, value: string) => void;
  onTypeChange: (id: string, value: "labor" | "material") => void;
  onOpenMaster: (itemId: string) => void;
  onOpenMaterial: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

export function CalculationRow({
  item,
  index,
  recentlySelected,
  onTextChange,
  onNumberChange,
  onTypeChange,
  onOpenMaster,
  onOpenMaterial,
  onDelete,
}: CalculationRowProps) {
  const line = calculateLine(item);
  const itemType = item.itemType ?? "labor";

  return (
    <motion.tr
      data-calculation-row-id={item.id}
      className={`h-14 border-b border-white/10 align-middle transition-colors hover:bg-white/[0.025] ${
        recentlySelected ? "bg-emerald-400/[0.08]" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.02, duration: 0.22 }}
    >
      <EstimateCell className="w-[250px] min-w-[240px] max-w-[280px] pr-5">
        <SmartWorkItemCell
          item={item}
          onOpenMaster={() => onOpenMaster(item.id)}
        />
      </EstimateCell>
      <EstimateCell className="w-[150px] min-w-[140px]">
        <MaterialAddAction item={item} onClick={() => onOpenMaterial(item.id)} />
      </EstimateCell>
      <EstimateCell className="w-[90px]">
        <ItemTypeSelect
          value={itemType}
          onChange={(value) => onTypeChange(item.id, value)}
        />
      </EstimateCell>
      <EstimateCell className="w-[115px] pl-4">
        <QuantityUnitInput
          quantity={item.quantity}
          unit={item.unit}
          unitOptions={itemType === "labor" ? laborUnits : commonUnits}
          onQuantityChange={(value) => onNumberChange(item.id, "quantity", value)}
          onUnitChange={(value) => onTextChange(item.id, "unit", value)}
        />
      </EstimateCell>
      <EstimateCell className="w-[105px]">
        {itemType === "material" ? (
          <EstimateInput
            value={String(item.baseCost ?? item.materialUnitCost ?? 0)}
            inputMode="numeric"
            onChange={(value) => onNumberChange(item.id, "baseCost", value)}
          />
        ) : (
          <span className="text-xs text-slate-500">-</span>
        )}
      </EstimateCell>
      <EstimateCell className="w-[90px]">
        {itemType === "material" ? (
          <RateInput
            value={item.markupRate ?? 1}
            onChange={(value) => onNumberChange(item.id, "markupRate", String(value))}
            suffix="x"
            scale={1}
            step="0.01"
            ariaLabel="掛率"
          />
        ) : (
          <span className="text-xs text-slate-500">-</span>
        )}
      </EstimateCell>
      <EstimateCell className="w-[110px]">
        {itemType === "labor" ? (
          <EstimateInput value={String(getEstimatedLaborUnitCost(item))} inputMode="numeric" onChange={(value) => onNumberChange(item.id, "estimatedLaborUnitCost", value)} />
        ) : (
          <EstimateInput value={String(getEstimatedUnitCost(item))} inputMode="numeric" onChange={(value) => onNumberChange(item.id, "estimatedUnitCost", value)} readOnly />
        )}
      </EstimateCell>
      <EstimateCell className="w-[95px]">
        {itemType === "labor" ? (
          <RateInput
            value={item.welfareRate ?? 0.25}
            onChange={(value) => onNumberChange(item.id, "welfareRate", String(value))}
          />
        ) : (
          <span className="text-xs text-slate-500">-</span>
        )}
      </EstimateCell>
      <EstimateMoneyCell value={line.subtotal} strong />
      <td className="h-14 w-10 py-3 pl-1 pr-4 text-right align-middle">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="工事項目を削除"
            className="size-8 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => {
              if (confirmDestructive("積算項目を削除します", `${item.majorCategory} / ${item.middleCategory} / ${item.name} を削除します。見積書・請求書の明細からも外れます。`)) {
                onDelete(item.id);
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </motion.tr>
  );
}

function RateInput({
  value,
  onChange,
  suffix = "%",
  scale = 100,
  step = "0.1",
  ariaLabel = "法定福利費率",
}: {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  scale?: number;
  step?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? formatInputNumber(scale === 100 ? Math.round(value * 1000) / 10 : value);

  return (
    <div className="flex h-9 items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.05] focus-within:border-emerald-400/60 focus-within:ring-3 focus-within:ring-emerald-400/15">
      <input
        value={displayValue}
        inputMode="decimal"
        step={step}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseNumericInput(event.target.value) / scale);
        }}
        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-left text-sm font-medium tabular-nums text-white outline-none"
        aria-label={ariaLabel}
      />
      <span className="pr-2 text-xs font-semibold text-slate-500">{suffix}</span>
    </div>
  );
}

export function EstimateCell({ className = "", children }: { className?: string; children: ReactNode }) {
  return <td className={`h-14 px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function EstimateInput({
  value,
  onChange,
  inputMode,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const numeric = inputMode === "numeric" || inputMode === "decimal";
  const displayValue = draft ?? (numeric ? formatInputNumber(value) : value);

  return (
    <input
      value={displayValue}
      inputMode={numeric ? "decimal" : inputMode}
      step={numeric ? "0.01" : undefined}
      readOnly={readOnly}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        if (readOnly) return;
        if (numeric) setDraft(event.target.value);
        onChange(event.target.value);
      }}
      className={`h-9 w-full min-w-0 rounded-lg border border-white/10 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 ${
        readOnly ? "bg-white/[0.025] text-slate-300" : "bg-white/[0.05]"
      } ${
        numeric ? "text-left font-medium tabular-nums" : ""
      }`}
    />
  );
}

function ItemTypeSelect({
  value,
  onChange,
}: {
  value: "labor" | "material";
  onChange: (value: "labor" | "material") => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as "labor" | "material")}
      className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 text-sm font-semibold text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
      aria-label="種別"
    >
      <option value="labor" className="bg-slate-950 text-white">人件費</option>
      <option value="material" className="bg-slate-950 text-white">材料費</option>
    </select>
  );
}

function MaterialAddAction({
  item,
  onClick,
}: {
  item: ProjectItem;
  onClick: () => void;
}) {
  const selectedMaterialName = getMaterialLabel(item.specification);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto min-h-9 w-full justify-start gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-left text-xs text-emerald-300 hover:bg-emerald-400/[0.10] hover:text-emerald-200"
      onClick={onClick}
      title={selectedMaterialName || "材料追加"}
    >
      <Package className="size-3.5" />
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {selectedMaterialName || "材料追加"}
        </span>
        {selectedMaterialName && <span className="block text-[10px] text-slate-500">クリックして変更</span>}
      </span>
    </Button>
  );
}

function getMaterialLabel(specification?: string) {
  const value = specification?.trim() ?? "";
  if (!value) return "";
  const productName = value
    .replace(/品番：[^ ]+\s*/g, "")
    .replace(/メーカー：.*$/g, "")
    .replace(/規格：.*$/g, "")
    .replace(/（.*?製）/g, "")
    .trim();
  return productName || value;
}

function SmartWorkItemCell({
  item,
  onOpenMaster,
}: {
  item: ProjectItem;
  onOpenMaster: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onOpenMaster}
        className="group flex min-h-12 w-full items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-2 text-left transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.13]"
      >
        <Search className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-semibold leading-5 text-white" title={`${item.majorCategory} / ${item.middleCategory} / ${item.name}`}>
            <span className="text-emerald-300">{item.middleCategory || "未分類"}</span>
            <span className="mx-1 text-slate-500">›</span>
            {item.name || "工事項目"}
          </span>
        </span>
      </button>
    </div>
  );
}

function QuantityUnitInput({
  quantity,
  unit,
  unitOptions,
  onQuantityChange,
  onUnitChange,
}: {
  quantity: number;
  unit: string;
  unitOptions: string[];
  onQuantityChange: (value: string) => void;
  onUnitChange: (value: string) => void;
}) {
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const quantityValue = quantityDraft ?? formatInputNumber(quantity);
  const selectedUnit = unitOptions.includes(unit) ? unit : unitOptions[0] ?? "";

  return (
    <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] focus-within:border-emerald-400/60 focus-within:ring-3 focus-within:ring-emerald-400/15">
      <input
        value={quantityValue}
        inputMode="decimal"
        step="0.01"
        onBlur={() => setQuantityDraft(null)}
        onChange={(event) => {
          setQuantityDraft(event.target.value);
          onQuantityChange(event.target.value);
        }}
        className="h-9 min-w-0 flex-1 bg-transparent px-2 text-left text-sm font-semibold tabular-nums text-white outline-none"
        aria-label="数量"
      />
      <select
        value={selectedUnit}
        onChange={(event) => onUnitChange(event.target.value)}
        className="h-9 w-[52px] shrink-0 appearance-none border-l border-white/10 bg-emerald-400/[0.12] px-1 text-center text-xs font-semibold text-emerald-100 outline-none"
        aria-label="単位"
        title={selectedUnit}
      >
        {unitOptions.map((candidate) => (
          <option key={candidate} value={candidate} className="bg-slate-950 text-white">
            {candidate}
          </option>
        ))}
      </select>
    </div>
  );
}

function EstimateMoneyCell({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <td className={`h-14 whitespace-nowrap px-4 py-3 text-left align-middle tabular-nums ${strong ? "min-w-[125px] text-base font-bold text-emerald-700 dark:text-emerald-300" : "min-w-[105px] text-[15px] font-semibold text-slate-900 dark:text-slate-200"}`}>
      {formatCurrency(value)}
    </td>
  );
}
