import { Calculator } from "lucide-react";
import { formatCurrency, parseNumericInput } from "@/features/calculation/lib/formatting";
import type { EstimateTotals } from "@/features/calculation/lib/calculation";
import { formatProfitRate, profitTextClass, profitToneClass } from "@/features/calculation/lib/profit";
import type { ProfitComparison } from "@/features/calculation/lib/profit";
import { formatTaxRateLabel, projectTaxRateOptions } from "@/lib/tax";
import type { ProjectCostSettings, ProjectTaxRateType } from "@/stores/project-store";

type CalculationSummaryPanelProps = {
  settings: ProjectCostSettings;
  totals: EstimateTotals;
  profitComparison: ProfitComparison;
  taxRate: number;
  taxRateType: ProjectTaxRateType;
  onUpdateCostSettings: (input: Partial<ProjectCostSettings>) => void;
  onUpdateTaxRateType: (taxRateType: ProjectTaxRateType) => void;
};

export function CalculationSummaryPanel({
  settings,
  totals,
  profitComparison,
  taxRate,
  taxRateType,
  onUpdateCostSettings,
  onUpdateTaxRateType,
}: CalculationSummaryPanelProps) {
  return (
    <aside className="h-fit rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl xl:sticky xl:top-4">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-[#1E3A8A]/60 text-emerald-300">
          <Calculator className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">積算合計</h3>
          <p className="text-xs text-slate-500">リアルタイム集計</p>
        </div>
      </div>

      <div className="space-y-3">
        <TotalRow label="材料費合計" value={totals.materialCost} />
        <TotalRow label="労務費合計" value={totals.laborCost} />
        <TotalRow label="法定福利費" value={totals.welfareCost} />
        <TotalRow label="総労務費" value={totals.totalLaborCost} strong />
        <TotalRow label="共通仮設費" value={totals.commonTemporaryCost} />
        <TotalRow label="現場管理費" value={totals.siteManagementCost} />
        <div className="h-px bg-white/10" />
        <TotalRow label="総原価" value={totals.directSubtotal} strong />
        <TotalRow label="税抜合計" value={totals.beforeTax} strong />
        <TotalRow label={`消費税（${formatTaxRateLabel(taxRate)}）`} value={totals.tax} />
        <TotalRow label="税込合計" value={totals.afterTax} accent />
      </div>

      <div className={`mt-5 rounded-xl border p-4 ring-1 ring-white/10 ${profitToneClass(profitComparison.actual.grossMarginRate)}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold">総合粗利率</h4>
            <p className="mt-1 text-xs opacity-85">見積粗利と実行粗利の差異</p>
          </div>
          <div className="grid gap-2 text-right">
            <div>
              <div className="text-xs opacity-75">見積</div>
              <div className="text-xl font-bold tabular-nums">{formatProfitRate(profitComparison.estimated.grossMarginRate)}</div>
              <div className={`text-xs font-semibold tabular-nums ${profitTextClass(profitComparison.estimated.grossMarginRate)}`}>
                {formatCurrency(profitComparison.estimated.grossProfit)}
              </div>
            </div>
            <div>
              <div className="text-xs opacity-75">実行</div>
              <div className="text-2xl font-bold tabular-nums">{formatProfitRate(profitComparison.actual.grossMarginRate)}</div>
              <div className={`text-sm font-semibold tabular-nums ${profitTextClass(profitComparison.actual.grossMarginRate)}`}>
                {formatCurrency(profitComparison.actual.grossProfit)}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums">
              差額 {profitComparison.profitDiff >= 0 ? "+" : ""}{formatCurrency(profitComparison.profitDiff)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4">
        <h4 className="text-sm font-semibold text-emerald-300">自動按分設定</h4>
        <div className="mt-4 grid gap-3">
          <RateField
            label="共通仮設費率"
            value={settings.commonTemporaryRate}
            onChange={(value) => onUpdateCostSettings({ commonTemporaryRate: value })}
          />
          <RateField
            label="現場管理費率"
            value={settings.siteManagementRate}
            onChange={(value) => onUpdateCostSettings({ siteManagementRate: value })}
          />
          <TaxRateSelector value={taxRateType} onChange={onUpdateTaxRateType} />
        </div>
      </div>
    </aside>
  );
}

function TaxRateSelector({
  value,
  onChange,
}: {
  value: ProjectTaxRateType;
  onChange: (value: ProjectTaxRateType) => void;
}) {
  return (
    <div className="grid gap-1.5 text-xs text-slate-400">
      <span>消費税率</span>
      <div className="grid grid-cols-3 gap-2">
        {projectTaxRateOptions.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`h-9 rounded-lg border px-2 text-xs font-semibold transition ${
                active
                  ? "border-emerald-300/70 bg-emerald-400/20 text-white ring-1 ring-emerald-300/30"
                  : "border-white/10 bg-slate-950/55 text-slate-300 hover:border-emerald-300/40 hover:bg-emerald-400/10"
              }`}
            >
              {option.shortLabel}
            </button>
          );
        })}
      </div>
      <span className="text-[11px] leading-4 text-slate-500">案件単位で見積書・請求書・PDFに反映されます。</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
  accent = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`${accent ? "text-xl font-semibold text-emerald-300" : strong ? "font-semibold text-white" : "text-slate-200"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function RateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-slate-400">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          value={String(Math.round(value * 100))}
          inputMode="numeric"
          onChange={(event) => onChange(parseNumericInput(event.target.value) / 100)}
          disabled={disabled}
          className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/55 px-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <span className="text-slate-500">%</span>
      </div>
    </label>
  );
}
